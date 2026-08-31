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
