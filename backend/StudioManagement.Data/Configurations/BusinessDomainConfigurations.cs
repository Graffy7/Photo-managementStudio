using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Configurations;

public class LeadConfiguration : IEntityTypeConfiguration<Lead>
{
    public void Configure(EntityTypeBuilder<Lead> b)
    {
        b.HasKey(x => x.LeadId);
        b.Property(x => x.FullName).IsRequired().HasMaxLength(200);
        b.Property(x => x.MobileNumber).IsRequired().HasMaxLength(20);
        b.Property(x => x.Email).HasMaxLength(256);
        b.Property(x => x.ExpectedBudget).HasColumnType("decimal(18,2)");
        b.Property(x => x.ExpectedEventDate).HasColumnType("datetime2");
        b.Property(x => x.FollowUpDate).HasColumnType("datetime2");
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");

        b.HasIndex(x => new { x.StudioId, x.LeadStatusId });
        b.HasIndex(x => new { x.StudioId, x.FollowUpDate });
        b.HasIndex(x => new { x.StudioId, x.ExpectedEventDate });

        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.EventType).WithMany()
            .HasForeignKey(x => x.EventTypeId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.LeadSource).WithMany()
            .HasForeignKey(x => x.LeadSourceId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.LeadStatus).WithMany()
            .HasForeignKey(x => x.LeadStatusId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.ConvertedCustomer).WithMany()
            .HasForeignKey(x => x.ConvertedCustomerId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> b)
    {
        b.HasKey(x => x.CustomerId);
        b.Property(x => x.FullName).IsRequired().HasMaxLength(200);
        b.Property(x => x.MobileNumber).IsRequired().HasMaxLength(20);
        b.Property(x => x.Email).HasMaxLength(256);
        b.Property(x => x.Address).HasMaxLength(500);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");

        b.HasIndex(x => new { x.StudioId, x.MobileNumber });

        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class EventConfiguration : IEntityTypeConfiguration<Event>
{
    public void Configure(EntityTypeBuilder<Event> b)
    {
        b.HasKey(x => x.EventId);
        b.Property(x => x.Venue).HasMaxLength(200);
        b.Property(x => x.VenueAddress).HasMaxLength(500);
        b.Property(x => x.Budget).HasColumnType("decimal(18,2)");
        b.Property(x => x.EventStatus).IsRequired().HasMaxLength(30);
        b.Property(x => x.FileLocation).HasMaxLength(1000);
        b.Property(x => x.EventDate).HasColumnType("datetime2");
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");

        b.HasIndex(x => new { x.StudioId, x.EventDate });
        b.HasIndex(x => new { x.StudioId, x.EventTypeId });
        b.HasIndex(x => new { x.StudioId, x.EventStatus });

        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Customer).WithMany(x => x.Events)
            .HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.EventType).WithMany()
            .HasForeignKey(x => x.EventTypeId).OnDelete(DeleteBehavior.Restrict);

        b.ToTable(t => t.HasCheckConstraint("CK_Events_EventStatus", CheckConstraintSql.In("EventStatus", EventStatuses.All)));
    }
}

public class WorkerConfiguration : IEntityTypeConfiguration<Worker>
{
    public void Configure(EntityTypeBuilder<Worker> b)
    {
        b.HasKey(x => x.WorkerId);
        b.Property(x => x.FullName).IsRequired().HasMaxLength(200);
        b.Property(x => x.MobileNumber).HasMaxLength(20);
        b.Property(x => x.Email).HasMaxLength(256);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");

        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.WorkerType).WithMany()
            .HasForeignKey(x => x.WorkerTypeId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class EventWorkerConfiguration : IEntityTypeConfiguration<EventWorker>
{
    public void Configure(EntityTypeBuilder<EventWorker> b)
    {
        b.HasKey(x => x.EventWorkerId);
        b.Property(x => x.AssignedAt).HasColumnType("datetime2");

        b.HasIndex(x => new { x.EventId, x.WorkerId }).IsUnique();

        b.HasOne(x => x.Event).WithMany(x => x.EventWorkers)
            .HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Worker).WithMany(x => x.EventWorkers)
            .HasForeignKey(x => x.WorkerId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class ServiceConfiguration : IEntityTypeConfiguration<Service>
{
    public void Configure(EntityTypeBuilder<Service> b)
    {
        b.HasKey(x => x.ServiceId);
        b.Property(x => x.ServiceName).IsRequired().HasMaxLength(200);
        b.Property(x => x.Description).HasMaxLength(1000);
        b.Property(x => x.DefaultPrice).HasColumnType("decimal(18,2)");
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");

        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
    }
}
