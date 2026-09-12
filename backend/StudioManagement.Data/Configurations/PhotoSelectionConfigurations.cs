using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Configurations;

public class PhotoSelectionProjectConfiguration : IEntityTypeConfiguration<PhotoSelectionProject>
{
    public void Configure(EntityTypeBuilder<PhotoSelectionProject> b)
    {
        b.HasKey(x => x.PhotoSelectionProjectId);
        b.Property(x => x.Name).IsRequired().HasMaxLength(200);
        b.Property(x => x.SourceFolder).IsRequired().HasMaxLength(1000);
        b.Property(x => x.DestinationRootFolder).HasMaxLength(1000);
        b.Property(x => x.Status).IsRequired().HasMaxLength(30);
        b.Property(x => x.AccessTokenHash).HasMaxLength(200);
        b.Property(x => x.PinHash).HasMaxLength(200);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.Property(x => x.TokenExpiresAt).HasColumnType("datetime2");
        b.Property(x => x.LinkGeneratedAt).HasColumnType("datetime2");
        b.Property(x => x.FirstOpenedAt).HasColumnType("datetime2");
        b.Property(x => x.SelectionStartedAt).HasColumnType("datetime2");
        b.Property(x => x.SubmittedAt).HasColumnType("datetime2");
        b.Property(x => x.ReopenedAt).HasColumnType("datetime2");
        b.Property(x => x.ProcessedAt).HasColumnType("datetime2");

        b.HasIndex(x => x.AccessTokenHash).IsUnique().HasFilter("[AccessTokenHash] IS NOT NULL");
        b.HasIndex(x => new { x.StudioId, x.CustomerId });

        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Customer).WithMany()
            .HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Event).WithMany()
            .HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);

        b.ToTable(t => t.HasCheckConstraint("CK_PhotoSelectionProjects_Status", CheckConstraintSql.In("Status", PhotoSelectionStatuses.All)));
    }
}

public class PhotoConfiguration : IEntityTypeConfiguration<Photo>
{
    public void Configure(EntityTypeBuilder<Photo> b)
    {
        b.HasKey(x => x.PhotoId);
        b.Property(x => x.OriginalFileName).IsRequired().HasMaxLength(300);
        b.Property(x => x.RelativePath).IsRequired().HasMaxLength(1000);
        b.Property(x => x.ThumbnailPath).IsRequired().HasMaxLength(500);
        b.Property(x => x.PreviewPath).IsRequired().HasMaxLength(500);
        b.Property(x => x.SelectionType).IsRequired().HasMaxLength(20);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        b.Property(x => x.SelectedAt).HasColumnType("datetime2");

        b.HasIndex(x => new { x.PhotoSelectionProjectId, x.SelectionType });
        b.HasIndex(x => new { x.PhotoSelectionProjectId, x.PhotoNumber }).IsUnique();

        b.HasOne(x => x.SelectionProject).WithMany(x => x.Photos)
            .HasForeignKey(x => x.PhotoSelectionProjectId).OnDelete(DeleteBehavior.Cascade);

        b.ToTable(t => t.HasCheckConstraint("CK_Photos_SelectionType", CheckConstraintSql.In("SelectionType", PhotoSelectionTypes.All)));
    }
}

public class PhotoSelectionActivityConfiguration : IEntityTypeConfiguration<PhotoSelectionActivity>
{
    public void Configure(EntityTypeBuilder<PhotoSelectionActivity> b)
    {
        b.HasKey(x => x.PhotoSelectionActivityId);
        b.Property(x => x.Action).IsRequired().HasMaxLength(50);
        b.Property(x => x.OldSelectionType).HasMaxLength(20);
        b.Property(x => x.NewSelectionType).HasMaxLength(20);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");

        b.HasIndex(x => new { x.PhotoSelectionProjectId, x.CreatedAt });

        b.HasOne(x => x.SelectionProject).WithMany(x => x.Activities)
            .HasForeignKey(x => x.PhotoSelectionProjectId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Photo).WithMany()
            .HasForeignKey(x => x.PhotoId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class PhotoProcessingJobConfiguration : IEntityTypeConfiguration<PhotoProcessingJob>
{
    public void Configure(EntityTypeBuilder<PhotoProcessingJob> b)
    {
        b.HasKey(x => x.PhotoProcessingJobId);
        b.Property(x => x.Status).IsRequired().HasMaxLength(30);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.StartedAt).HasColumnType("datetime2");
        b.Property(x => x.CompletedAt).HasColumnType("datetime2");

        b.HasOne(x => x.SelectionProject).WithMany(x => x.ProcessingJobs)
            .HasForeignKey(x => x.PhotoSelectionProjectId).OnDelete(DeleteBehavior.Cascade);

        b.ToTable(t => t.HasCheckConstraint("CK_PhotoProcessingJobs_Status", CheckConstraintSql.In("Status", PhotoProcessingJobStatuses.All)));
    }
}

public class PhotoProcessingJobItemConfiguration : IEntityTypeConfiguration<PhotoProcessingJobItem>
{
    public void Configure(EntityTypeBuilder<PhotoProcessingJobItem> b)
    {
        b.HasKey(x => x.PhotoProcessingJobItemId);
        b.Property(x => x.Result).IsRequired().HasMaxLength(20);
        b.Property(x => x.ErrorMessage).HasMaxLength(500);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");

        b.HasOne(x => x.Job).WithMany(x => x.Items)
            .HasForeignKey(x => x.PhotoProcessingJobId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Photo).WithMany()
            .HasForeignKey(x => x.PhotoId).OnDelete(DeleteBehavior.Restrict);

        b.ToTable(t => t.HasCheckConstraint("CK_PhotoProcessingJobItems_Result", CheckConstraintSql.In("Result", PhotoProcessingResults.All)));
    }
}
