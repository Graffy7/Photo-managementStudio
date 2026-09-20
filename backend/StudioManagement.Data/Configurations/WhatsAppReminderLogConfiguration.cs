using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Configurations;

public class WhatsAppReminderLogConfiguration : IEntityTypeConfiguration<WhatsAppReminderLog>
{
    public void Configure(EntityTypeBuilder<WhatsAppReminderLog> b)
    {
        b.HasKey(x => x.WhatsAppReminderLogId);
        b.Property(x => x.ReminderDate).HasColumnType("date");
        b.Property(x => x.ReminderType).IsRequired().HasMaxLength(30);
        b.Property(x => x.RecipientType).IsRequired().HasMaxLength(20);
        b.Property(x => x.RecipientKey).IsRequired().HasMaxLength(40);
        b.Property(x => x.Status).IsRequired().HasMaxLength(20);
        b.Property(x => x.Detail).HasMaxLength(500);
        b.Property(x => x.SentAt).HasColumnType("datetime2");
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");

        // The de-duplication guarantee: however often the scheduler runs, one row (and so one
        // message) per event, day, kind and recipient.
        b.HasIndex(x => new { x.EventId, x.ReminderDate, x.ReminderType, x.RecipientKey }).IsUnique();
        b.HasIndex(x => new { x.StudioId, x.ReminderDate });

        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Event).WithMany()
            .HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Cascade);

        b.ToTable(t =>
        {
            t.HasCheckConstraint("CK_WhatsAppReminderLogs_Type", CheckConstraintSql.In("ReminderType", WhatsAppReminderTypes.All));
            t.HasCheckConstraint("CK_WhatsAppReminderLogs_Recipient", CheckConstraintSql.In("RecipientType", WhatsAppRecipientTypes.All));
            t.HasCheckConstraint("CK_WhatsAppReminderLogs_Status", CheckConstraintSql.In("Status", WhatsAppLogStatuses.All));
        });
    }
}
