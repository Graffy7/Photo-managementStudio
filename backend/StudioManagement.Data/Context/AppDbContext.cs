using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Context;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Studio> Studios => Set<Studio>();
    public DbSet<User> Users => Set<User>();
    public DbSet<SubscriptionPlan> SubscriptionPlans => Set<SubscriptionPlan>();
    public DbSet<StudioSubscription> StudioSubscriptions => Set<StudioSubscription>();
    public DbSet<SubscriptionPayment> SubscriptionPayments => Set<SubscriptionPayment>();
    public DbSet<Feature> Features => Set<Feature>();
    public DbSet<StudioFeature> StudioFeatures => Set<StudioFeature>();
    public DbSet<StudioSetting> StudioSettings => Set<StudioSetting>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();

    public DbSet<FormDefinition> FormDefinitions => Set<FormDefinition>();
    public DbSet<FormField> FormFields => Set<FormField>();
    public DbSet<FormFieldOption> FormFieldOptions => Set<FormFieldOption>();
    public DbSet<CustomFieldValue> CustomFieldValues => Set<CustomFieldValue>();
    public DbSet<EventType> EventTypes => Set<EventType>();
    public DbSet<LeadSource> LeadSources => Set<LeadSource>();
    public DbSet<LeadStatus> LeadStatuses => Set<LeadStatus>();
    public DbSet<WorkerType> WorkerTypes => Set<WorkerType>();

    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Event> Events => Set<Event>();
    public DbSet<Worker> Workers => Set<Worker>();
    public DbSet<EventWorker> EventWorkers => Set<EventWorker>();
    public DbSet<Service> Services => Set<Service>();

    public DbSet<Quotation> Quotations => Set<Quotation>();
    public DbSet<QuotationItem> QuotationItems => Set<QuotationItem>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<ExpenseCategory> ExpenseCategories => Set<ExpenseCategory>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
