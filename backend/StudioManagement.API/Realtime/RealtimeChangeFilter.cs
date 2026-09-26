using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using StudioManagement.Business.Realtime;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;
using A = StudioManagement.Business.Realtime.ChangeAreas;

namespace StudioManagement.API.Realtime;

// After any successful write (POST/PUT/PATCH/DELETE answered 2xx), tells the affected studio's other
// devices which areas changed. One place instead of a call in every service:
//   - a studio owner's own writes -> their studio (from the token's StudioId claim);
//   - the platform admin changing a studio (modules, access, trial, plan) -> that studio (route id).
// The device that made the change passes its connection id in X-Realtime-Connection so it isn't
// told about its own change.
public class RealtimeChangeFilter(IStudioChangeNotifier notifier, ITenantContext tenant) : IAsyncActionFilter
{
    public const string ConnectionHeader = "X-Realtime-Connection";

    // Owner-facing controllers -> what their writes can change on other screens.
    private static readonly Dictionary<string, string[]> OwnerAreas = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Customers"] = [A.Customers],
        ["Events"] = [A.Events],
        ["Payments"] = [A.Payments],
        ["Quotations"] = [A.Quotations],
        ["Workers"] = [A.Workers],
        ["Leads"] = [A.Leads, A.Customers],                 // converting an enquiry makes a customer
        ["Expenses"] = [A.Expenses],
        ["ExpenseCategories"] = [A.Expenses],
        ["Services"] = [A.Services],
        ["PhotoGalleries"] = [A.Photos],
        ["StudioProfile"] = [A.Settings],
        ["StudioSettings"] = [A.Settings],
        ["FormFields"] = [A.Settings],
        ["EventTypes"] = [A.Settings],
        ["LeadSources"] = [A.Settings],
        ["LeadStatuses"] = [A.Settings],
        ["WorkerTypes"] = [A.Settings],
        ["Notifications"] = [A.Notifications],
        ["Subscription"] = [A.Subscription],
    };

    // Admin controllers acting on one studio (id in the route) -> what that studio should re-read.
    private static readonly Dictionary<string, string[]> AdminAreas = new(StringComparer.OrdinalIgnoreCase)
    {
        ["StudioFeatures"] = [A.Modules],
        ["AdminConsole"] = [A.Subscription, A.Modules],
        ["Studios"] = [A.Subscription, A.Settings],
        ["Subscriptions"] = [A.Subscription],
    };

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var executed = await next();

        var method = context.HttpContext.Request.Method;
        if (HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method))
        {
            return;
        }
        if (executed.Exception is not null && !executed.ExceptionHandled)
        {
            return;
        }
        var status = (executed.Result as IStatusCodeActionResult)?.StatusCode ?? context.HttpContext.Response.StatusCode;
        if (status is < 200 or > 299 || context.ActionDescriptor is not ControllerActionDescriptor action)
        {
            return;
        }

        var controller = action.ControllerName;
        var user = context.HttpContext.User;
        int? studioId = null;
        string[]? areas = null;

        if (user.IsInRole(UserTypes.StudioOwner) && OwnerAreas.TryGetValue(controller, out var ownerAreas))
        {
            studioId = tenant.CurrentStudioId;
            areas = ownerAreas;
        }
        else if (user.IsInRole(UserTypes.SuperAdmin) && AdminAreas.TryGetValue(controller, out var adminAreas))
        {
            var routeId = context.RouteData.Values.TryGetValue("studioId", out var s) ? s : context.RouteData.Values.GetValueOrDefault("id");
            studioId = int.TryParse(routeId?.ToString(), out var id) ? id : null;
            areas = adminAreas;
        }

        if (studioId is null || areas is null)
        {
            return;
        }

        var from = context.HttpContext.Request.Headers[ConnectionHeader].ToString();
        await notifier.PublishAsync(studioId.Value, areas, string.IsNullOrWhiteSpace(from) ? null : from);
    }
}
