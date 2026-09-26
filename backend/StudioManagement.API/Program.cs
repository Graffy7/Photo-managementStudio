using StudioManagement.Business.Realtime;
using StudioManagement.API.Realtime;
using System.Text;
using System.Threading.RateLimiting;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Serilog;
using StudioManagement.API.BackgroundServices;
using StudioManagement.API.Infrastructure;
using StudioManagement.API.Middleware;
using StudioManagement.Business.Admin;
using StudioManagement.Business.Audit;
using StudioManagement.Business.Billing;
using StudioManagement.API.Filters;
using StudioManagement.API.Controllers;
using StudioManagement.Business.Auth;
using StudioManagement.Business.Dashboard;
using StudioManagement.Business.Email;
using StudioManagement.Business.Sms;
using StudioManagement.Business.Features;
using StudioManagement.Business.Customers;
using StudioManagement.Business.DayBoard;
using StudioManagement.Business.Events;
using StudioManagement.Business.ExpenseCategories;
using StudioManagement.Business.Expenses;
using StudioManagement.Business.FormConfig;
using StudioManagement.Business.Leads;
using StudioManagement.Business.Lookups;
using StudioManagement.Business.Notifications;
using StudioManagement.Business.Payments;
using StudioManagement.Business.PhotoSelection;
using StudioManagement.Business.Quotations;
using StudioManagement.Business.Reports;
using StudioManagement.Business.Services;
using StudioManagement.Business.Settings;
using StudioManagement.Business.Workers;
using StudioManagement.Business.WhatsApp;
using StudioManagement.Business.Storage;
using StudioManagement.Business.Studios;
using StudioManagement.Business.Subscriptions;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

// Don't advertise the web server (and its version) on every response.
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext());

// Every studio request needs a running subscription or trial (see SubscriptionRequiredFilter).
builder.Services.AddControllers(options =>
{
    options.Filters.Add<SubscriptionRequiredFilter>();
    // Tells a studio's other signed-in devices what a successful write changed (SignalR).
    options.Filters.Add<RealtimeChangeFilter>();
});
builder.Services.AddSignalR();
builder.Services.AddSingleton<IStudioChangeNotifier, SignalRStudioChangeNotifier>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Studio OS API",
        Version = "v1",
        Description = "Multi-tenant studio management platform API."
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the access token from /api/auth/login."
    });
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>();

builder.Services.AddHttpContextAccessor();
builder.Services.AddMemoryCache();
builder.Services.AddScoped<ITenantContext, TenantContext>();

builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
builder.Services.AddScoped(typeof(ITenantRepository<>), typeof(TenantRepository<>));
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IStudioRepository, StudioRepository>();
builder.Services.AddScoped<IAuditLogRepository, AuditLogRepository>();
builder.Services.AddScoped<IStudioUsageRepository, StudioUsageRepository>();
builder.Services.AddScoped<IAdminConsoleRepository, AdminConsoleRepository>();
builder.Services.AddScoped<IStorageUsageService, StorageUsageService>();
builder.Services.AddScoped<IAdminConsoleService, AdminConsoleService>();
builder.Services.AddScoped<IStudioAccessService, StudioAccessService>();
builder.Services.AddScoped<ISubscriptionLedger, SubscriptionLedger>();
builder.Services.AddScoped<ISubscriptionOrderRepository, SubscriptionOrderRepository>();
builder.Services.AddScoped<IBillingService, BillingService>();
builder.Services.AddScoped<IValidator<VerifyPaymentRequestDto>, VerifyPaymentRequestValidator>();
builder.Services.AddScoped<IValidator<PdfSettingsDto>, PdfSettingsValidator>();
builder.Services.AddSingleton(builder.Configuration.GetSection("Payments:Razorpay").Get<RazorpayOptions>() ?? new RazorpayOptions());
builder.Services.AddHttpClient<IPaymentGateway, RazorpayGateway>(client => client.Timeout = TimeSpan.FromSeconds(20));
builder.Services.AddScoped<IValidator<TrialDaysRequestDto>, TrialDaysRequestValidator>();
builder.Services.AddScoped<IValidator<ManualPaymentRequestDto>, ManualPaymentRequestValidator>();
builder.Services.AddSingleton<UsageTracker>();
builder.Services.AddHostedService<UsageFlushBackgroundService>();
builder.Services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
builder.Services.AddScoped<IPasswordResetTokenRepository, PasswordResetTokenRepository>();
builder.Services.AddScoped<IStudioFeatureRepository, StudioFeatureRepository>();
builder.Services.AddScoped<IStudioSubscriptionRepository, StudioSubscriptionRepository>();
builder.Services.AddScoped<ISubscriptionPaymentRepository, SubscriptionPaymentRepository>();
builder.Services.AddScoped<IDashboardRepository, DashboardRepository>();
builder.Services.AddScoped<IStudioDashboardRepository, StudioDashboardRepository>();
builder.Services.AddScoped<IFormDefinitionRepository, FormDefinitionRepository>();
builder.Services.AddScoped<ILeadRepository, LeadRepository>();
builder.Services.AddScoped<ICustomerRepository, CustomerRepository>();
builder.Services.AddScoped<IEventRepository, EventRepository>();
builder.Services.AddScoped<IWorkerRepository, WorkerRepository>();
builder.Services.AddScoped<IServiceCatalogRepository, ServiceCatalogRepository>();
builder.Services.AddScoped<IQuotationRepository, QuotationRepository>();
builder.Services.AddScoped<IPaymentRepository, PaymentRepository>();
builder.Services.AddScoped<IExpenseCategoryRepository, ExpenseCategoryRepository>();
builder.Services.AddScoped<IExpenseRepository, ExpenseRepository>();
builder.Services.AddScoped<IProfitReportRepository, ProfitReportRepository>();
builder.Services.AddScoped<IEventWorkerRepository, EventWorkerRepository>();
builder.Services.AddScoped<IEventDeliveryRepository, EventDeliveryRepository>();
builder.Services.AddScoped<INotificationRepository, NotificationRepository>();
builder.Services.AddScoped<IStudioSettingRepository, StudioSettingRepository>();
builder.Services.AddSingleton<IFileStorage, LocalFileStorage>();
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();

builder.Services.AddScoped<IPasswordHasher, BCryptPasswordHasher>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IRefreshTokenService, RefreshTokenService>();
builder.Services.AddScoped<IPasswordResetService, PasswordResetService>();
builder.Services.AddSingleton<ILoginThrottle, LoginThrottle>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IStudioService, StudioService>();
builder.Services.AddScoped<IStudioSettingsService, StudioSettingsService>();
builder.Services.AddScoped<IFeatureService, FeatureService>();
builder.Services.AddScoped<ISubscriptionPlanService, SubscriptionPlanService>();
builder.Services.AddScoped<ISubscriptionService, SubscriptionService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IStudioDashboardService, StudioDashboardService>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<IFormConfigurationService, FormConfigurationService>();
builder.Services.AddScoped<ILeadService, LeadService>();
builder.Services.AddScoped<ICustomerService, CustomerService>();
builder.Services.AddScoped<IEventService, EventService>();
builder.Services.AddScoped<IWorkerService, WorkerService>();
builder.Services.AddScoped<IServiceCatalogService, ServiceCatalogService>();
builder.Services.AddScoped<IQuotationService, QuotationService>();
builder.Services.AddScoped<IQuotationPdfService, QuotationPdfService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddScoped<IExpenseCategoryService, ExpenseCategoryService>();
builder.Services.AddScoped<IExpenseService, ExpenseService>();
builder.Services.AddScoped<IProfitReportService, ProfitReportService>();
builder.Services.AddScoped<IEventWorkerService, EventWorkerService>();
builder.Services.AddScoped<IEventDeliveryService, EventDeliveryService>();
builder.Services.AddScoped<IDayBoardService, DayBoardService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IEventReminderService, EventReminderService>();
builder.Services.AddHostedService<EventReminderBackgroundService>();

// WhatsApp day-before reminders: two separate messages (event/worker, and owner-only payment). With no
// provider configured (the default) messages are only written to the log.
var whatsAppOptions = builder.Configuration.GetSection("WhatsApp").Get<WhatsAppOptions>() ?? new WhatsAppOptions();
builder.Services.AddSingleton(whatsAppOptions);
if (whatsAppOptions.Provider == WhatsAppOptions.CloudApiProvider)
{
    builder.Services.AddSingleton<IWhatsAppSender, CloudApiWhatsAppSender>();
}
else
{
    builder.Services.AddSingleton<IWhatsAppSender, LoggingWhatsAppSender>();
}
builder.Services.AddScoped<IWhatsAppReminderLogRepository, WhatsAppReminderLogRepository>();
builder.Services.AddScoped<IWhatsAppReminderService, WhatsAppReminderService>();

// Photo selection: previews are generated by a background worker fed from a queue, and expired
// galleries' preview files are swept daily.
builder.Services.AddScoped<IPhotoGalleryRepository, PhotoGalleryRepository>();
builder.Services.AddScoped<IPhotoRepository, PhotoRepository>();
builder.Services.AddScoped<IPhotoFolderRepository, PhotoFolderRepository>();
builder.Services.AddScoped<IPhotoCopyRepository, PhotoCopyRepository>();
builder.Services.AddSingleton(builder.Configuration.GetSection("PhotoGallery").Get<PhotoGalleryOptions>() ?? new PhotoGalleryOptions());
builder.Services.AddSingleton<ILinkTokenProtector, LinkTokenProtector>();
builder.Services.AddSingleton<IPhotoPreviewGenerator, ImageSharpPhotoPreviewGenerator>();
builder.Services.AddSingleton<IPhotoImportQueue, PhotoImportQueue>();
builder.Services.AddSingleton<IPhotoCopyQueue, PhotoCopyQueue>();
builder.Services.AddScoped<IPhotoImportService, PhotoImportService>();
builder.Services.AddScoped<IStudioPhotoRootService, StudioPhotoRootService>();
builder.Services.AddScoped<IPhotoSelectionCopyService, PhotoSelectionCopyService>();
builder.Services.AddScoped<IPhotoGalleryService, PhotoGalleryService>();
builder.Services.AddScoped<IPhotoFolderService, PhotoFolderService>();
builder.Services.AddScoped<IPublicPhotoSelectionService, PublicPhotoSelectionService>();
builder.Services.AddScoped<IGalleryCleanupService, GalleryCleanupService>();
builder.Services.AddScoped<IValidator<ImportRequestDto>, ImportRequestValidator>();
builder.Services.AddScoped<IValidator<SaveFolderRequestDto>, SaveFolderRequestValidator>();
builder.Services.AddScoped<IValidator<GenerateLinkRequestDto>, GenerateLinkRequestValidator>();
builder.Services.AddScoped<IValidator<SetSelectionRequestDto>, SetSelectionRequestValidator>();
builder.Services.AddHostedService<PhotoImportBackgroundService>();
builder.Services.AddHostedService<PhotoCopyBackgroundService>();
builder.Services.AddHostedService<GalleryCleanupBackgroundService>();

builder.Services.AddScoped<ILookupService<EventType>, LookupService<EventType>>();
builder.Services.AddScoped<ILookupService<LeadSource>, LookupService<LeadSource>>();
builder.Services.AddScoped<ILookupService<LeadStatus>, LookupService<LeadStatus>>();
builder.Services.AddScoped<ILookupService<WorkerType>, LookupService<WorkerType>>();
builder.Services.AddScoped<IValidator<CreateLookupRequestDto>, CreateLookupRequestValidator>();
builder.Services.AddScoped<IValidator<UpdateLookupRequestDto>, UpdateLookupRequestValidator>();
builder.Services.AddScoped<IValidator<UpdateFormFieldRequestDto>, UpdateFormFieldRequestValidator>();
builder.Services.AddScoped<IValidator<CreateCustomFieldRequestDto>, CreateCustomFieldRequestValidator>();
builder.Services.AddScoped<IValidator<CreateLeadRequestDto>, CreateLeadRequestValidator>();
builder.Services.AddScoped<IValidator<UpdateLeadRequestDto>, UpdateLeadRequestValidator>();
builder.Services.AddScoped<IValidator<CreateCustomerRequestDto>, CreateCustomerRequestValidator>();
builder.Services.AddScoped<IValidator<UpdateCustomerRequestDto>, UpdateCustomerRequestValidator>();
builder.Services.AddScoped<IValidator<CreateEventRequestDto>, CreateEventRequestValidator>();
builder.Services.AddScoped<IValidator<AddDeliveryItemRequestDto>, AddDeliveryItemRequestValidator>();
builder.Services.AddScoped<IValidator<SetDeliveryStatusRequestDto>, SetDeliveryStatusRequestValidator>();
builder.Services.AddScoped<IValidator<UpdateEventRequestDto>, UpdateEventRequestValidator>();
builder.Services.AddScoped<IValidator<CreateWorkerRequestDto>, CreateWorkerRequestValidator>();
builder.Services.AddScoped<IValidator<UpdateWorkerRequestDto>, UpdateWorkerRequestValidator>();
builder.Services.AddScoped<IValidator<CreateServiceRequestDto>, CreateServiceRequestValidator>();
builder.Services.AddScoped<IValidator<UpdateServiceRequestDto>, UpdateServiceRequestValidator>();
builder.Services.AddScoped<IValidator<CreateQuotationRequestDto>, CreateQuotationRequestValidator>();
builder.Services.AddScoped<IValidator<UpdateQuotationRequestDto>, UpdateQuotationRequestValidator>();
builder.Services.AddScoped<IValidator<SetQuotationStatusRequestDto>, SetQuotationStatusRequestValidator>();
builder.Services.AddScoped<IValidator<CreatePaymentRequestDto>, CreatePaymentRequestValidator>();
builder.Services.AddScoped<IValidator<UpdatePaymentRequestDto>, UpdatePaymentRequestValidator>();
builder.Services.AddScoped<IValidator<CreateExpenseCategoryRequestDto>, CreateExpenseCategoryRequestValidator>();
builder.Services.AddScoped<IValidator<UpdateExpenseCategoryRequestDto>, UpdateExpenseCategoryRequestValidator>();
builder.Services.AddScoped<IValidator<CreateExpenseRequestDto>, CreateExpenseRequestValidator>();
builder.Services.AddScoped<IValidator<UpdateExpenseRequestDto>, UpdateExpenseRequestValidator>();

if (!string.IsNullOrWhiteSpace(builder.Configuration["Email:Smtp:Host"]))
{
    builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
}
else
{
    builder.Services.AddScoped<IEmailSender, LoggingEmailSender>();
}

// Phone codes for Forgot password (Sms:Provider). "Log" writes texts to the log (development);
// "Twilio" and "Msg91" send real SMS with keys from user-secrets / environment. Unset = the phone
// option is hidden. A provider missing its keys stops the API at startup with a clear message
// rather than failing quietly when someone needs a code.
switch (builder.Configuration["Sms:Provider"])
{
    case "Log":
    case null or "":
        builder.Services.AddScoped<ISmsSender, LoggingSmsSender>();
        break;
    case "Twilio":
    {
        var twilio = builder.Configuration.GetSection("Sms:Twilio").Get<TwilioOptions>() ?? new TwilioOptions();
        if (string.IsNullOrWhiteSpace(twilio.AccountSid) || string.IsNullOrWhiteSpace(twilio.AuthToken)
            || (string.IsNullOrWhiteSpace(twilio.From) && string.IsNullOrWhiteSpace(twilio.MessagingServiceSid)))
        {
            throw new InvalidOperationException("Sms:Provider is Twilio but Sms:Twilio:AccountSid, AuthToken and From (or MessagingServiceSid) aren't all set.");
        }
        builder.Services.AddSingleton(twilio);
        builder.Services.AddHttpClient<ISmsSender, TwilioSmsSender>(client => client.Timeout = TimeSpan.FromSeconds(15));
        break;
    }
    case "Msg91":
    {
        var msg91 = builder.Configuration.GetSection("Sms:Msg91").Get<Msg91Options>() ?? new Msg91Options();
        if (string.IsNullOrWhiteSpace(msg91.AuthKey) || string.IsNullOrWhiteSpace(msg91.TemplateId))
        {
            throw new InvalidOperationException("Sms:Provider is Msg91 but Sms:Msg91:AuthKey and TemplateId aren't both set.");
        }
        builder.Services.AddSingleton(msg91);
        builder.Services.AddHttpClient<ISmsSender, Msg91SmsSender>(client => client.Timeout = TimeSpan.FromSeconds(15));
        break;
    }
    default:
        throw new InvalidOperationException($"Unknown Sms:Provider '{builder.Configuration["Sms:Provider"]}' (use Log, Twilio or Msg91).");
}

builder.Services.AddScoped<IValidator<LoginRequestDto>, LoginRequestValidator>();
builder.Services.AddScoped<IValidator<SendResetCodeRequestDto>, SendResetCodeRequestValidator>();
builder.Services.AddScoped<IValidator<VerifyResetCodeRequestDto>, VerifyResetCodeRequestValidator>();
builder.Services.AddScoped<IValidator<RefreshRequestDto>, RefreshRequestValidator>();
builder.Services.AddScoped<IValidator<LogoutRequestDto>, LogoutRequestValidator>();
builder.Services.AddScoped<IValidator<ForgotPasswordRequestDto>, ForgotPasswordRequestValidator>();
builder.Services.AddScoped<IValidator<ResetPasswordRequestDto>, ResetPasswordRequestValidator>();
builder.Services.AddScoped<IValidator<ChangePasswordRequestDto>, ChangePasswordRequestValidator>();
builder.Services.AddScoped<IValidator<CreateStudioRequestDto>, CreateStudioRequestValidator>();
builder.Services.AddScoped<IValidator<UpdateStudioRequestDto>, UpdateStudioRequestValidator>();
builder.Services.AddScoped<IValidator<ResetStudioPasswordRequestDto>, ResetStudioPasswordRequestValidator>();
builder.Services.AddScoped<IValidator<RenewSubscriptionRequestDto>, RenewSubscriptionRequestValidator>();
builder.Services.AddScoped<IValidator<BusinessSettingsDto>, BusinessSettingsValidator>();
builder.Services.AddScoped<IValidator<QuotationSettingsDto>, QuotationSettingsValidator>();
builder.Services.AddScoped<SuperAdminSeeder>();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", httpContext => RateLimitPartition.GetFixedWindowLimiter(
        $"{httpContext.Request.Path}:{httpContext.Connection.RemoteIpAddress}",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 5,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        }));
    // Sign-in: a burst limit per connection that an office of people can share. Wrong-password
    // limits per account and per connection are in LoginThrottle.
    options.AddPolicy("login", httpContext => RateLimitPartition.GetFixedWindowLimiter(
        httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 20,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        }));
    // The customer photo-selection page fires a request per tap and per scroll page, so it gets a far
    // roomier window than "auth". Keyed by IP only (not path) so one browser shares one budget.
    options.AddPolicy("public-gallery", httpContext => RateLimitPartition.GetFixedWindowLimiter(
        httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 300,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        }));
    // Starting/confirming payments: plenty for a person, a wall for a script.
    options.AddPolicy("checkout", httpContext => RateLimitPartition.GetFixedWindowLimiter(
        httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 20,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        }));
});

var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key is not configured. Set it with `dotnet user-secrets set \"Jwt:Key\" \"<value>\"`.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
        // Browsers can't set an Authorization header on a WebSocket, so the live-updates hub (and
        // only it) accepts the access token from the query string.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var token = context.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) && context.HttpContext.Request.Path.StartsWithSegments(StudioHub.Path))
                {
                    context.Token = token;
                }
                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy("StudioAppClients", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseSerilogRequestLogging();

// Security headers on every response (API JSON, PDFs, uploaded images, errors). The API never
// serves pages of its own, so its CSP allows nothing to run or embed it; Swagger's UI (development
// only) needs its own scripts and styles, so it gets a looser policy.
var uploadImageExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp" };
app.Use(async (context, next) =>
{
    var path = context.Request.Path;
    context.Response.OnStarting(() =>
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "no-referrer";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()";
        headers["Content-Security-Policy"] = path.StartsWithSegments("/swagger")
            ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'"
            : "default-src 'none'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
        headers.Remove("X-Powered-By");
        return Task.CompletedTask;
    });

    // Only images are ever served from /uploads - never a script, page or anything executable,
    // whatever ended up on disk.
    if (path.StartsWithSegments("/uploads") && !uploadImageExtensions.Contains(Path.GetExtension(path.Value ?? "")))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }

    await next();
});

app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "Studio OS API v1");
    });
}

if (!app.Environment.IsDevelopment())
{
    // Browsers remember to use HTTPS only (production, where the API is served over TLS).
    app.UseHsts();
}
app.UseHttpsRedirection();

// Serves uploaded logos (wwwroot/uploads/...) as plain public image URLs — logos aren't
// sensitive, so this sits ahead of auth rather than behind an authorized endpoint.
app.UseStaticFiles(new StaticFileOptions
{
    // Photo previews have random, never-reused file names, so they can be cached for good — a
    // customer scrolling back through hundreds of thumbnails re-downloads nothing.
    OnPrepareResponse = ctx =>
    {
        if (ctx.Context.Request.Path.StartsWithSegments("/uploads/photo-gallery"))
        {
            ctx.Context.Response.Headers.CacheControl = "public,max-age=31536000,immutable";
        }
    }
});

app.UseCors("StudioAppClients");

app.UseAuthentication();
app.UseAuthorization();

// Counts a studio's active time from its own signed-in requests (see UsageTracker).
app.Use(async (context, next) =>
{
    var user = context.User;
    if (user.Identity?.IsAuthenticated == true &&
        user.FindFirst(TenantClaimTypes.UserType)?.Value == UserTypes.StudioOwner &&
        int.TryParse(user.FindFirst(TenantClaimTypes.StudioId)?.Value, out var usageStudioId))
    {
        context.RequestServices.GetRequiredService<UsageTracker>().Record(usageStudioId, DateTime.UtcNow);
    }
    await next();
});
app.UseRateLimiter();

app.MapControllers();
// Live updates for a studio's devices. The connection closes when its access token expires, and
// the app reconnects with a fresh one - a signed-out or expired session doesn't keep listening.
app.MapHub<StudioHub>(StudioHub.Path, options => options.CloseOnAuthenticationExpiration = true);

// Unauthenticated by design: an infra load balancer/orchestrator probe needs a reachable
// endpoint, but it only ever gets a bare "Healthy"/"Unhealthy" string — no connection
// details, migration state, or claims (that detail lives behind /api/diagnostics instead).
app.MapHealthChecks("/health");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var dbName = db.Database.GetDbConnection().Database;

    // Dashboard summaries run a sequence of separate count/sum queries and need them all to see
    // one consistent instant — read-committed-snapshot alone only guarantees that per statement,
    // not across the whole sequence. This is a one-time, idempotent database setting (not a
    // schema change), so it's safe to ensure on every startup rather than requiring a manual step.
    // dbName comes from our own connection string, not external input, and ALTER DATABASE's
    // identifier can't be parameterized anyway, so raw interpolation here is safe.
#pragma warning disable EF1003
    await db.Database.ExecuteSqlRawAsync(
        $"IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = '{dbName}' AND snapshot_isolation_state = 1) " +
        $"ALTER DATABASE [{dbName}] SET ALLOW_SNAPSHOT_ISOLATION ON;");
#pragma warning restore EF1003

    await scope.ServiceProvider.GetRequiredService<SuperAdminSeeder>().SeedAsync();
}

app.Run();
