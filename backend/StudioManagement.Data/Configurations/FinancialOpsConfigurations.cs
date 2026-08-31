using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Configurations;

public class QuotationConfiguration : IEntityTypeConfiguration<Quotation>
{
    public void Configure(EntityTypeBuilder<Quotation> b)
    {
        b.HasKey(x => x.QuotationId);
        b.Property(x => x.QuotationNumber).IsRequired().HasMaxLength(50);
        b.Property(x => x.Subtotal).HasColumnType("decimal(18,2)");
        b.Property(x => x.Discount).HasColumnType("decimal(18,2)");
        b.Property(x => x.TaxAmount).HasColumnType("decimal(18,2)");
        b.Property(x => x.GrandTotal).HasColumnType("decimal(18,2)");
        b.Property(x => x.Status).IsRequired().HasMaxLength(30);
        b.Property(x => x.QuotationDate).HasColumnType("datetime2");
        b.Property(x => x.ValidUntil).HasColumnType("datetime2");
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.Property(x => x.RowVersion).IsRowVersion();

        b.HasIndex(x => new { x.StudioId, x.QuotationNumber }).IsUnique();
        b.HasIndex(x => new { x.StudioId, x.EventId });
        b.HasIndex(x => new { x.StudioId, x.CustomerId });
        b.HasIndex(x => new { x.StudioId, x.Status });

        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Customer).WithMany(x => x.Quotations)
            .HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Event).WithMany(x => x.Quotations)
            .HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);

        b.ToTable(t => t.HasCheckConstraint("CK_Quotations_Status", CheckConstraintSql.In("Status", QuotationStatuses.All)));
    }
}

public class QuotationItemConfiguration : IEntityTypeConfiguration<QuotationItem>
{
    public void Configure(EntityTypeBuilder<QuotationItem> b)
    {
        b.HasKey(x => x.QuotationItemId);
        b.Property(x => x.Quantity).HasColumnType("decimal(18,2)");
        b.Property(x => x.UnitPrice).HasColumnType("decimal(18,2)");
        b.Property(x => x.Total).HasColumnType("decimal(18,2)");

        b.HasOne(x => x.Quotation).WithMany(x => x.Items)
            .HasForeignKey(x => x.QuotationId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Service).WithMany(x => x.QuotationItems)
            .HasForeignKey(x => x.ServiceId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> b)
    {
        b.HasKey(x => x.PaymentId);
        b.Property(x => x.Amount).HasColumnType("decimal(18,2)");
        b.Property(x => x.PaymentMethod).IsRequired().HasMaxLength(30);
        b.Property(x => x.ReferenceNumber).HasMaxLength(100);
        b.Property(x => x.PaymentStatus).IsRequired().HasMaxLength(30);
        b.Property(x => x.PaymentDate).HasColumnType("datetime2");
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.Property(x => x.RowVersion).IsRowVersion();

        b.HasIndex(x => new { x.StudioId, x.PaymentDate });
        b.HasIndex(x => new { x.StudioId, x.EventId });

        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Customer).WithMany(x => x.Payments)
            .HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Event).WithMany(x => x.Payments)
            .HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.SetNull);

        b.ToTable(t => t.HasCheckConstraint("CK_Payments_PaymentMethod", CheckConstraintSql.In("PaymentMethod", PaymentMethods.All)));
        b.ToTable(t => t.HasCheckConstraint("CK_Payments_PaymentStatus", CheckConstraintSql.In("PaymentStatus", PaymentStatuses.All)));
    }
}

public class ExpenseCategoryConfiguration : IEntityTypeConfiguration<ExpenseCategory>
{
    public void Configure(EntityTypeBuilder<ExpenseCategory> b)
    {
        b.HasKey(x => x.ExpenseCategoryId);
        b.Property(x => x.CategoryName).IsRequired().HasMaxLength(150);
        b.Property(x => x.Description).HasMaxLength(500);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");

        b.HasIndex(x => new { x.StudioId, x.CategoryName }).IsUnique();

        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class ExpenseConfiguration : IEntityTypeConfiguration<Expense>
{
    public void Configure(EntityTypeBuilder<Expense> b)
    {
        b.HasKey(x => x.ExpenseId);
        b.Property(x => x.Amount).HasColumnType("decimal(18,2)");
        b.Property(x => x.Description).HasMaxLength(500);
        b.Property(x => x.PaymentMethod).HasMaxLength(30);
        b.Property(x => x.ReferenceNumber).HasMaxLength(100);
        b.Property(x => x.ExpenseDate).HasColumnType("datetime2");
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.Property(x => x.RowVersion).IsRowVersion();

        b.HasIndex(x => new { x.StudioId, x.ExpenseDate });
        b.HasIndex(x => new { x.StudioId, x.EventId });
        b.HasIndex(x => new { x.StudioId, x.ExpenseCategoryId });

        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.ExpenseCategory).WithMany(x => x.Expenses)
            .HasForeignKey(x => x.ExpenseCategoryId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Event).WithMany(x => x.Expenses)
            .HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.Worker).WithMany(x => x.Expenses)
            .HasForeignKey(x => x.WorkerId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> b)
    {
        b.HasKey(x => x.NotificationId);
        b.Property(x => x.Title).IsRequired().HasMaxLength(200);
        b.Property(x => x.Message).IsRequired().HasMaxLength(1000);
        b.Property(x => x.NotificationType).IsRequired().HasMaxLength(50);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");

        b.HasIndex(x => new { x.StudioId, x.IsRead, x.CreatedAt });

        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.User).WithMany()
            .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.SetNull);
    }
}
