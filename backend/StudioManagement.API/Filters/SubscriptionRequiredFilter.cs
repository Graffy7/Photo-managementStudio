using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using StudioManagement.Business.Billing;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Filters;

// Marks endpoints a studio can use whatever its subscription says: signing in/out, its
// subscription page and renewing, and the few calls that page needs.
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class AllowWithoutSubscriptionAttribute : Attribute;

// A write that is housekeeping, not business (e.g. marking a notification read): allowed while read-only.
[AttributeUsage(AttributeTargets.Method)]
public class AllowWhenReadOnlyAttribute : Attribute;

// A read that acts (e.g. preparing a message that sends a customer link): refused while read-only.
[AttributeUsage(AttributeTargets.Method)]
public class BlockWhenReadOnlyAttribute : Attribute;

// Applied to every controller action (registered globally), on the server with the server's clock
// - hiding buttons isn't the only thing in the way, and changing the device's date changes nothing:
//  - full access: everything its enabled modules allow;
//  - read-only (subscription lapsed, or set by the platform admin): reading works, any change
//    (create/edit/delete/send/upload) gets 402 SUBSCRIPTION_READ_ONLY;
//  - suspended: 403 STUDIO_SUSPENDED.
// The studio's data is never touched either way.
// A resource filter, so it runs before the request body is even read or validated: a read-only
// studio is told "subscription required", not "your form has errors".
public class SubscriptionRequiredFilter(IStudioAccessService accessService) : IAsyncResourceFilter
{
    private static readonly HashSet<string> ReadMethods = new(StringComparer.OrdinalIgnoreCase) { "GET", "HEAD", "OPTIONS" };

    public async Task OnResourceExecutionAsync(ResourceExecutingContext context, ResourceExecutionDelegate next)
    {
        var user = context.HttpContext.User;
        var isStudioOwner = user.Identity?.IsAuthenticated == true &&
                            user.FindFirst(TenantClaimTypes.UserType)?.Value == UserTypes.StudioOwner;
        var exempt = context.ActionDescriptor.EndpointMetadata.OfType<AllowWithoutSubscriptionAttribute>().Any();

        if (isStudioOwner && !exempt && int.TryParse(user.FindFirst(TenantClaimTypes.StudioId)?.Value, out var studioId))
        {
            var access = await accessService.GetAsync(studioId, context.HttpContext.RequestAborted);
            if (access.Level == AccessLevel.None)
            {
                context.Result = new ObjectResult(new
                {
                    code = "STUDIO_SUSPENDED",
                    reason = access.Reason,
                    message = "Your studio's access is suspended. Please contact support."
                })
                { StatusCode = StatusCodes.Status403Forbidden };
                return;
            }

            var metadata = context.ActionDescriptor.EndpointMetadata;
            var isWrite = metadata.OfType<BlockWhenReadOnlyAttribute>().Any() ||
                          (!ReadMethods.Contains(context.HttpContext.Request.Method) && !metadata.OfType<AllowWhenReadOnlyAttribute>().Any());
            if (access.Level == AccessLevel.ReadOnly && isWrite)
            {
                context.Result = new ObjectResult(new
                {
                    code = "SUBSCRIPTION_READ_ONLY",
                    reason = access.Reason,
                    message = access.Reason == "ReadOnlyByAdmin"
                        ? "Your studio is in read-only mode. Please contact support to restore full access."
                        : "Subscription required: your studio is read-only until the subscription is renewed. Your data is safe."
                })
                { StatusCode = StatusCodes.Status402PaymentRequired };
                return;
            }
        }

        await next();
    }
}
