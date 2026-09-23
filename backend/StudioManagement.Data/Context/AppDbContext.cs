using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
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
    public DbSet<EventDeliveryItem> EventDeliveryItems => Set<EventDeliveryItem>();
    public DbSet<Service> Services => Set<Service>();

    public DbSet<Quotation> Quotations => Set<Quotation>();
    public DbSet<QuotationItem> QuotationItems => Set<QuotationItem>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<ExpenseCategory> ExpenseCategories => Set<ExpenseCategory>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<PhotoGallery> PhotoGalleries => Set<PhotoGallery>();
    public DbSet<Photo> Photos => Set<Photo>();
    public DbSet<PhotoSelection> PhotoSelections => Set<PhotoSelection>();
    public DbSet<PhotoImportJob> PhotoImportJobs => Set<PhotoImportJob>();
    public DbSet<PhotoCopyJob> PhotoCopyJobs => Set<PhotoCopyJob>();
    public DbSet<WhatsAppReminderLog> WhatsAppReminderLogs => Set<WhatsAppReminderLog>();
    public DbSet<PhotoSelectionCopy> PhotoSelectionCopies => Set<PhotoSelectionCopy>();


    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        MarkTimestampsAsUtc(modelBuilder);
    }

    // Every "...At" column (CreatedAt, UpdatedAt, LastLoginAt, SubmittedAt, ...) is written from
    // DateTime.UtcNow, but SQL Server hands it back without a time zone, so the API sent e.g.
    // "03:34:03" and browsers read it as local time — 5.5 hours off in India. Tagging these values as
    // UTC when they're read makes the API send "03:34:03Z", which every client converts correctly.
    //
    // Calendar dates (EventDate, PaymentDate, ValidUntil, ...) are deliberately left alone: they're a
    // day on the calendar, not an instant, and must not move when shown in another time zone.
    private static void MarkTimestampsAsUtc(ModelBuilder modelBuilder)
    {
        var utc = new ValueConverter<DateTime, DateTime>(
            toDb => toDb.Kind == DateTimeKind.Local ? toDb.ToUniversalTime() : toDb,
            fromDb => DateTime.SpecifyKind(fromDb, DateTimeKind.Utc));

        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entity.GetProperties())
            {
                var isDateTime = property.ClrType == typeof(DateTime) || property.ClrType == typeof(DateTime?);
                if (isDateTime && property.Name.EndsWith("At", StringComparison.Ordinal) && property.GetValueConverter() is null)
                {
                    property.SetValueConverter(utc);
                }
            }
        }
    }
}
