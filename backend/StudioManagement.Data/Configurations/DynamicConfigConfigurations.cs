using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Configurations;

public class FormDefinitionConfiguration : IEntityTypeConfiguration<FormDefinition>
{
    public void Configure(EntityTypeBuilder<FormDefinition> b)
    {
        b.HasKey(x => x.FormDefinitionId);
        b.Property(x => x.FormCode).IsRequired().HasMaxLength(60);
        b.Property(x => x.FormName).IsRequired().HasMaxLength(150);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.HasIndex(x => new { x.StudioId, x.FormCode }).IsUnique();
        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class FormFieldConfiguration : IEntityTypeConfiguration<FormField>
{
    public void Configure(EntityTypeBuilder<FormField> b)
    {
        b.HasKey(x => x.FormFieldId);
        b.Property(x => x.FieldKey).IsRequired().HasMaxLength(100);
        b.Property(x => x.Label).IsRequired().HasMaxLength(150);
        b.Property(x => x.FieldType).IsRequired().HasMaxLength(30);
        b.Property(x => x.Placeholder).HasMaxLength(200);
        b.Property(x => x.DefaultValue).HasMaxLength(500);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.HasIndex(x => new { x.FormDefinitionId, x.FieldKey }).IsUnique();
        b.HasOne(x => x.FormDefinition).WithMany(x => x.FormFields)
            .HasForeignKey(x => x.FormDefinitionId).OnDelete(DeleteBehavior.Cascade);

        b.ToTable(t => t.HasCheckConstraint("CK_FormFields_FieldType", CheckConstraintSql.In("FieldType", FieldTypes.All)));
    }
}

public class FormFieldOptionConfiguration : IEntityTypeConfiguration<FormFieldOption>
{
    public void Configure(EntityTypeBuilder<FormFieldOption> b)
    {
        b.HasKey(x => x.FormFieldOptionId);
        b.Property(x => x.OptionValue).IsRequired().HasMaxLength(150);
        b.Property(x => x.OptionLabel).IsRequired().HasMaxLength(150);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.HasOne(x => x.FormField).WithMany(x => x.Options)
            .HasForeignKey(x => x.FormFieldId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class CustomFieldValueConfiguration : IEntityTypeConfiguration<CustomFieldValue>
{
    public void Configure(EntityTypeBuilder<CustomFieldValue> b)
    {
        b.HasKey(x => x.CustomFieldValueId);
        b.Property(x => x.EntityType).IsRequired().HasMaxLength(50);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.HasIndex(x => new { x.EntityType, x.EntityId });
        b.HasIndex(x => new { x.FormFieldId, x.EntityType, x.EntityId }).IsUnique();
        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.FormDefinition).WithMany()
            .HasForeignKey(x => x.FormDefinitionId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.FormField).WithMany(x => x.CustomFieldValues)
            .HasForeignKey(x => x.FormFieldId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class EventTypeConfiguration : IEntityTypeConfiguration<EventType>
{
    public void Configure(EntityTypeBuilder<EventType> b)
    {
        b.HasKey(x => x.EventTypeId);
        b.Property(x => x.Name).IsRequired().HasMaxLength(150);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.HasIndex(x => new { x.StudioId, x.Name }).IsUnique();
        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class LeadSourceConfiguration : IEntityTypeConfiguration<LeadSource>
{
    public void Configure(EntityTypeBuilder<LeadSource> b)
    {
        b.HasKey(x => x.LeadSourceId);
        b.Property(x => x.Name).IsRequired().HasMaxLength(150);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.HasIndex(x => new { x.StudioId, x.Name }).IsUnique();
        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class LeadStatusConfiguration : IEntityTypeConfiguration<LeadStatus>
{
    public void Configure(EntityTypeBuilder<LeadStatus> b)
    {
        b.HasKey(x => x.LeadStatusId);
        b.Property(x => x.Name).IsRequired().HasMaxLength(150);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.HasIndex(x => new { x.StudioId, x.Name }).IsUnique();
        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class WorkerTypeConfiguration : IEntityTypeConfiguration<WorkerType>
{
    public void Configure(EntityTypeBuilder<WorkerType> b)
    {
        b.HasKey(x => x.WorkerTypeId);
        b.Property(x => x.Name).IsRequired().HasMaxLength(150);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.HasIndex(x => new { x.StudioId, x.Name }).IsUnique();
        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
    }
}
