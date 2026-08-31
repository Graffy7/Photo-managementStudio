using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using StudioManagement.Business.Features;
using StudioManagement.Business.Tenant;

namespace StudioManagement.API.Filters;

public class FeatureRequiredAttribute : TypeFilterAttribute
{
    public FeatureRequiredAttribute(string featureCode) : base(typeof(FeatureRequiredFilter))
    {
        Arguments = [featureCode];
    }
}

public class FeatureRequiredFilter(string featureCode, IFeatureService featureService, ITenantContext tenantContext) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (tenantContext.CurrentStudioId is not { } studioId)
        {
            context.Result = new ForbidResult();
            return;
        }

        var enabled = await featureService.IsEnabledAsync(studioId, featureCode, context.HttpContext.RequestAborted);
        if (!enabled)
        {
            context.Result = new ObjectResult(new { message = $"The {featureCode} module is not enabled for your studio." })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
            return;
        }

        await next();
    }
}
