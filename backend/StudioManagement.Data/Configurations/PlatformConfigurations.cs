using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Configurations;

internal static class CheckConstraintSql
{
    public static string In(string column, IEnumerable<string> values) =>
        $"[{column}] IN ({string.Join(",", values.Select(v => $"'{v}'"))})";
}

public class StudioConfiguration : IEntityTypeConfiguration<Studio>
{
    public void Configure(EntityTypeBuilder<Studio> b)
    {
        b.HasKey(x => x.StudioId);
        b.Property(x => x.StudioName).IsRequired().HasMaxLength(200);
        b.Property(x => x.OwnerName).HasMaxLength(200);
        b.Property(x => x.Email).IsRequired().HasMaxLength(256);
        b.Property(x => x.PhoneNumber).HasMaxLength(30);
        b.Property(x => x.Address).HasMaxLength(500);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.HasIndex(x => x.Email).IsUnique();
    }
}

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.HasKey(x => x.UserId);
        b.Property(x => x.FullName).IsRequired().HasMaxLength(200);
        b.Property(x => x.Email).IsRequired().HasMaxLength(256);
        b.Property(x => x.PasswordHash).IsRequired();
        b.Property(x => x.UserType).IsRequired().HasMaxLength(30);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.HasIndex(x => x.Email).IsUnique();
        b.HasOne(x => x.Studio).WithMany(x => x.Users)
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
        b.ToTable(t => t.HasCheckConstraint("CK_Users_UserType", CheckConstraintSql.In("UserType", UserTypes.All)));
    }
}

public class SubscriptionPlanConfiguration : IEntityTypeConfiguration<SubscriptionPlan>
{
    public void Configure(EntityTypeBuilder<SubscriptionPlan> b)
    {
        b.HasKey(x => x.SubscriptionPlanId);
        b.Property(x => x.PlanName).IsRequired().HasMaxLength(150);
        b.Property(x => x.PlanType).IsRequired().HasMaxLength(30);
        b.Property(x => x.Price).HasColumnType("decimal(18,2)");
        b.Property(x => x.Description).HasMaxLength(1000);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.ToTable(t => t.HasCheckConstraint("CK_SubscriptionPlans_PlanType", CheckConstraintSql.In("PlanType", SubscriptionPlanTypes.All)));

        var seedDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        b.HasData(
            new SubscriptionPlan { SubscriptionPlanId = 1, PlanName = "Monthly", PlanType = SubscriptionPlanTypes.Monthly, Price = 999m, DurationInDays = 30, Description = "Billed every month.", IsActive = true, CreatedAt = seedDate, UpdatedAt = seedDate },
            new SubscriptionPlan { SubscriptionPlanId = 2, PlanName = "Yearly", PlanType = SubscriptionPlanTypes.Yearly, Price = 9999m, DurationInDays = 365, Description = "Billed once a year — two months free versus Monthly.", IsActive = true, CreatedAt = seedDate, UpdatedAt = seedDate }
        );
    }
}

public class StudioSubscriptionConfiguration : IEntityTypeConfiguration<StudioSubscription>
{
    public void Configure(EntityTypeBuilder<StudioSubscription> b)
    {
        b.HasKey(x => x.StudioSubscriptionId);
        b.Property(x => x.Amount).HasColumnType("decimal(18,2)");
        b.Property(x => x.Status).IsRequired().HasMaxLength(30);
        b.Property(x => x.StartDate).HasColumnType("datetime2");
        b.Property(x => x.EndDate).HasColumnType("datetime2");
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.HasIndex(x => new { x.StudioId, x.Status });
        b.HasOne(x => x.Studio).WithMany(x => x.Subscriptions)
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.SubscriptionPlan).WithMany(x => x.StudioSubscriptions)
            .HasForeignKey(x => x.SubscriptionPlanId).OnDelete(DeleteBehavior.Restrict);
        b.ToTable(t => t.HasCheckConstraint("CK_StudioSubscriptions_Status", CheckConstraintSql.In("Status", SubscriptionStatuses.All)));
    }
}

public class SubscriptionPaymentConfiguration : IEntityTypeConfiguration<SubscriptionPayment>
{
    public void Configure(EntityTypeBuilder<SubscriptionPayment> b)
    {
        b.HasKey(x => x.SubscriptionPaymentId);
        b.Property(x => x.Amount).HasColumnType("decimal(18,2)");
        b.Property(x => x.PaymentDate).HasColumnType("datetime2");
        b.Property(x => x.PaymentMethod).IsRequired().HasMaxLength(30);
        b.Property(x => x.ReferenceNumber).HasMaxLength(100);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.HasOne(x => x.StudioSubscription).WithMany(x => x.Payments)
            .HasForeignKey(x => x.StudioSubscriptionId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class FeatureConfiguration : IEntityTypeConfiguration<Feature>
{
    public void Configure(EntityTypeBuilder<Feature> b)
    {
        b.HasKey(x => x.FeatureId);
        b.Property(x => x.FeatureCode).IsRequired().HasMaxLength(60);
        b.Property(x => x.FeatureName).IsRequired().HasMaxLength(150);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.HasIndex(x => x.FeatureCode).IsUnique();

        var seedDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        b.HasData(
            new Feature { FeatureId = 1, FeatureCode = "LEADS", FeatureName = "Leads", Description = "Capture and follow up on enquiries.", IsActive = true, CreatedAt = seedDate, UpdatedAt = seedDate },
            new Feature { FeatureId = 2, FeatureCode = "CUSTOMERS", FeatureName = "Customers", Description = "Customer records and history.", IsActive = true, CreatedAt = seedDate, UpdatedAt = seedDate },
            new Feature { FeatureId = 3, FeatureCode = "EVENTS", FeatureName = "Events", Description = "Bookings, schedules, and event status.", IsActive = true, CreatedAt = seedDate, UpdatedAt = seedDate },
            new Feature { FeatureId = 4, FeatureCode = "WORKERS", FeatureName = "Workers", Description = "Photographers, videographers, and crew.", IsActive = true, CreatedAt = seedDate, UpdatedAt = seedDate },
            new Feature { FeatureId = 5, FeatureCode = "SERVICES", FeatureName = "Services", Description = "The service catalog studios quote from.", IsActive = true, CreatedAt = seedDate, UpdatedAt = seedDate },
            new Feature { FeatureId = 6, FeatureCode = "QUOTATIONS", FeatureName = "Quotations", Description = "Quote building and PDF generation.", IsActive = true, CreatedAt = seedDate, UpdatedAt = seedDate },
            new Feature { FeatureId = 7, FeatureCode = "PAYMENTS", FeatureName = "Payments", Description = "Customer payment collection.", IsActive = true, CreatedAt = seedDate, UpdatedAt = seedDate },
            new Feature { FeatureId = 8, FeatureCode = "EXPENSES", FeatureName = "Expenses", Description = "Studio expense tracking.", IsActive = true, CreatedAt = seedDate, UpdatedAt = seedDate },
            new Feature { FeatureId = 9, FeatureCode = "REPORTS", FeatureName = "Reports", Description = "Profit and financial reporting.", IsActive = true, CreatedAt = seedDate, UpdatedAt = seedDate },
            new Feature { FeatureId = 10, FeatureCode = "DAY_BOARD", FeatureName = "Day Board", Description = "Day/week/month schedule view.", IsActive = true, CreatedAt = seedDate, UpdatedAt = seedDate },
            new Feature { FeatureId = 11, FeatureCode = "NOTIFICATIONS", FeatureName = "Notifications", Description = "In-app reminders and alerts.", IsActive = true, CreatedAt = seedDate, UpdatedAt = seedDate }
        );
    }
}

public class StudioFeatureConfiguration : IEntityTypeConfiguration<StudioFeature>
{
    public void Configure(EntityTypeBuilder<StudioFeature> b)
    {
        b.HasKey(x => x.StudioFeatureId);
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.HasIndex(x => new { x.StudioId, x.FeatureId }).IsUnique();
        b.HasOne(x => x.Studio).WithMany(x => x.StudioFeatures)
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Feature).WithMany(x => x.StudioFeatures)
            .HasForeignKey(x => x.FeatureId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class StudioSettingConfiguration : IEntityTypeConfiguration<StudioSetting>
{
    public void Configure(EntityTypeBuilder<StudioSetting> b)
    {
        b.HasKey(x => x.StudioSettingId);
        b.Property(x => x.SettingKey).IsRequired().HasMaxLength(100);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.HasIndex(x => new { x.StudioId, x.SettingKey }).IsUnique();
        b.HasOne(x => x.Studio).WithMany(x => x.Settings)
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> b)
    {
        b.HasKey(x => x.AuditLogId);
        b.Property(x => x.Action).IsRequired().HasMaxLength(100);
        b.Property(x => x.Module).IsRequired().HasMaxLength(100);
        b.Property(x => x.EntityName).IsRequired().HasMaxLength(100);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.HasIndex(x => new { x.StudioId, x.CreatedAt });
        b.HasOne<Studio>().WithMany().HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> b)
    {
        b.HasKey(x => x.RefreshTokenId);
        b.Property(x => x.TokenHash).IsRequired().HasMaxLength(128);
        b.Property(x => x.CreatedByIp).HasMaxLength(64);
        b.Property(x => x.ExpiresAt).HasColumnType("datetime2");
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.RevokedAt).HasColumnType("datetime2");
        b.Ignore(x => x.IsActive);

        b.HasIndex(x => x.TokenHash);
        b.HasIndex(x => x.UserId);

        b.HasOne(x => x.User).WithMany()
            .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class PasswordResetTokenConfiguration : IEntityTypeConfiguration<PasswordResetToken>
{
    public void Configure(EntityTypeBuilder<PasswordResetToken> b)
    {
        b.HasKey(x => x.PasswordResetTokenId);
        b.Property(x => x.TokenHash).IsRequired().HasMaxLength(128);
        b.Property(x => x.ExpiresAt).HasColumnType("datetime2");
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UsedAt).HasColumnType("datetime2");
        b.Ignore(x => x.IsActive);

        b.HasIndex(x => x.TokenHash);
        b.HasIndex(x => x.UserId);

        b.HasOne(x => x.User).WithMany()
            .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
