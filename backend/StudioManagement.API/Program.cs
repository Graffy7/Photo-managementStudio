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
using StudioManagement.Business.Audit;
using StudioManagement.Business.Auth;
using StudioManagement.Business.Dashboard;
using StudioManagement.Business.Email;
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
using StudioManagement.Business.Quotations;
using StudioManagement.Business.Reports;
using StudioManagement.Business.Services;
using StudioManagement.Business.Settings;
using StudioManagement.Business.Workers;
using StudioManagement.Business.Storage;
using StudioManagement.Business.Studios;
using StudioManagement.Business.Subscriptions;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext());

builder.Services.AddControllers();
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
builder.Services.AddScoped<ITenantContext, TenantContext>();

builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
builder.Services.AddScoped(typeof(ITenantRepository<>), typeof(TenantRepository<>));
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IStudioRepository, StudioRepository>();
builder.Services.AddScoped<IAuditLogRepository, AuditLogRepository>();
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
builder.Services.AddScoped<INotificationRepository, NotificationRepository>();
builder.Services.AddScoped<IStudioSettingRepository, StudioSettingRepository>();
builder.Services.AddSingleton<IFileStorage, LocalFileStorage>();
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();

builder.Services.AddScoped<IPasswordHasher, BCryptPasswordHasher>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IRefreshTokenService, RefreshTokenService>();
builder.Services.AddScoped<IPasswordResetService, PasswordResetService>();
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
builder.Services.AddScoped<IDayBoardService, DayBoardService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IEventReminderService, EventReminderService>();
builder.Services.AddHostedService<EventReminderBackgroundService>();

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

builder.Services.AddScoped<IValidator<LoginRequestDto>, LoginRequestValidator>();
builder.Services.AddScoped<IValidator<RefreshRequestDto>, RefreshRequestValidator>();
builder.Services.AddScoped<IValidator<LogoutRequestDto>, LogoutRequestValidator>();
builder.Services.AddScoped<IValidator<ForgotPasswordRequestDto>, ForgotPasswordRequestValidator>();
builder.Services.AddScoped<IValidator<ResetPasswordRequestDto>, ResetPasswordRequestValidator>();
builder.Services.AddScoped<IValidator<ChangePasswordRequestDto>, ChangePasswordRequestValidator>();
builder.Services.AddScoped<IValidator<CreateStudioRequestDto>, CreateStudioRequestValidator>();
builder.Services.AddScoped<IValidator<UpdateStudioRequestDto>, UpdateStudioRequestValidator>();
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

app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "Studio OS API v1");
    });
}

app.UseHttpsRedirection();

// Serves uploaded logos (wwwroot/uploads/...) as plain public image URLs — logos aren't
// sensitive, so this sits ahead of auth rather than behind an authorized endpoint.
app.UseStaticFiles();

app.UseCors("StudioAppClients");

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();

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
