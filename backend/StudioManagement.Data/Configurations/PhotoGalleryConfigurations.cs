using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Configurations;

public class PhotoGalleryConfiguration : IEntityTypeConfiguration<PhotoGallery>
{
    public void Configure(EntityTypeBuilder<PhotoGallery> b)
    {
        b.HasKey(x => x.PhotoGalleryId);
        b.Property(x => x.SourceFolder).HasMaxLength(1000);
        b.Property(x => x.TokenHash).HasMaxLength(200);
        b.Property(x => x.TokenProtected).HasMaxLength(400);
        b.Property(x => x.Status).IsRequired().HasMaxLength(20);
        b.Property(x => x.ExpiresAt).HasColumnType("datetime2");
        b.Property(x => x.LinkGeneratedAt).HasColumnType("datetime2");
        b.Property(x => x.FirstOpenedAt).HasColumnType("datetime2");
        b.Property(x => x.LastSelectionAt).HasColumnType("datetime2");
        b.Property(x => x.SubmittedAt).HasColumnType("datetime2");
        b.Property(x => x.PreviewsPurgedAt).HasColumnType("datetime2");
        b.Property(x => x.FoldersBackfilledAt).HasColumnType("datetime2");
        b.Property(x => x.SelectionCreatedAt).HasColumnType("datetime2");
        b.Property(x => x.SelectionSyncedAt).HasColumnType("datetime2");
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");

        // One gallery per event; the customer link is resolved by the hash of a random token.
        b.HasIndex(x => x.EventId).IsUnique();
        b.HasIndex(x => x.TokenHash).IsUnique().HasFilter("[TokenHash] IS NOT NULL");
        b.HasIndex(x => new { x.StudioId, x.CustomerId });

        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Customer).WithMany()
            .HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Event).WithMany()
            .HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);

        b.ToTable(t => t.HasCheckConstraint("CK_PhotoGalleries_Status", CheckConstraintSql.In("Status", GalleryStatuses.All)));
    }
}

public class PhotoFolderConfiguration : IEntityTypeConfiguration<PhotoFolder>
{
    public void Configure(EntityTypeBuilder<PhotoFolder> b)
    {
        b.HasKey(x => x.PhotoFolderId);
        b.Property(x => x.Name).IsRequired().HasMaxLength(100);
        b.Property(x => x.DeliveredAt).HasColumnType("datetime2");
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");

        // One folder of a given name per gallery, so an import can look a folder up by name.
        b.HasIndex(x => new { x.PhotoGalleryId, x.Name }).IsUnique();

        b.HasOne(x => x.Gallery).WithMany(x => x.Folders)
            .HasForeignKey(x => x.PhotoGalleryId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Studio).WithMany()
            .HasForeignKey(x => x.StudioId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class PhotoConfiguration : IEntityTypeConfiguration<Photo>
{
    public void Configure(EntityTypeBuilder<Photo> b)
    {
        b.HasKey(x => x.PhotoId);
        b.Property(x => x.FileName).IsRequired().HasMaxLength(300);
        b.Property(x => x.SourceFolder).HasMaxLength(1000);
        b.Property(x => x.SourceRelativePath).IsRequired().HasMaxLength(1000);
        b.Property(x => x.ThumbnailPath).HasMaxLength(500);
        b.Property(x => x.PreviewPath).HasMaxLength(500);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");

        b.HasIndex(x => new { x.PhotoGalleryId, x.PhotoNumber }).IsUnique();
        b.HasIndex(x => new { x.PhotoGalleryId, x.FileName });

        b.HasOne(x => x.Gallery).WithMany(x => x.Photos)
            .HasForeignKey(x => x.PhotoGalleryId).OnDelete(DeleteBehavior.Cascade);

        // Removing a folder must never remove photos. SQL Server won't allow SET NULL here (the
        // gallery already cascades into both tables), so the service unfiles the photos itself
        // before deleting the folder and this FK simply refuses to leave orphans behind.
        b.HasIndex(x => x.PhotoFolderId);
        b.HasOne(x => x.Folder).WithMany(x => x.Photos)
            .HasForeignKey(x => x.PhotoFolderId).OnDelete(DeleteBehavior.NoAction);
    }
}

public class PhotoSelectionConfiguration : IEntityTypeConfiguration<PhotoSelection>
{
    public void Configure(EntityTypeBuilder<PhotoSelection> b)
    {
        b.HasKey(x => x.PhotoSelectionId);
        b.Property(x => x.SelectedAt).HasColumnType("datetime2");
        b.Property(x => x.UpdatedAt).HasColumnType("datetime2");

        // Counts (Normal / Big / total) are always "selections in this gallery grouped by type".
        b.HasIndex(x => new { x.PhotoGalleryId, x.SelectionType });

        // The unique FK on PhotoId is what guarantees a single selection row per photo.
        b.HasOne(x => x.Photo).WithOne(x => x.Selection)
            .HasForeignKey<PhotoSelection>(x => x.PhotoId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Gallery).WithMany()
            .HasForeignKey(x => x.PhotoGalleryId).OnDelete(DeleteBehavior.Restrict);

        b.ToTable(t => t.HasCheckConstraint("CK_PhotoSelections_SelectionType", "[SelectionType] IN (1, 2)"));
    }
}

public class PhotoImportJobConfiguration : IEntityTypeConfiguration<PhotoImportJob>
{
    public void Configure(EntityTypeBuilder<PhotoImportJob> b)
    {
        b.HasKey(x => x.PhotoImportJobId);
        b.Property(x => x.Status).IsRequired().HasMaxLength(30);
        b.Property(x => x.SourceFolder).IsRequired().HasMaxLength(1000);
        b.Property(x => x.ErrorMessage).HasMaxLength(1000);
        b.Property(x => x.StartedAt).HasColumnType("datetime2");
        b.Property(x => x.CompletedAt).HasColumnType("datetime2");
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");

        b.HasIndex(x => new { x.PhotoGalleryId, x.CreatedAt });

        b.HasOne(x => x.Gallery).WithMany()
            .HasForeignKey(x => x.PhotoGalleryId).OnDelete(DeleteBehavior.Cascade);

        b.ToTable(t => t.HasCheckConstraint("CK_PhotoImportJobs_Status", CheckConstraintSql.In("Status", ImportJobStatuses.All)));
    }
}

public class PhotoCopyJobConfiguration : IEntityTypeConfiguration<PhotoCopyJob>
{
    public void Configure(EntityTypeBuilder<PhotoCopyJob> b)
    {
        b.HasKey(x => x.PhotoCopyJobId);
        b.Property(x => x.Kind).IsRequired().HasMaxLength(10);
        b.Property(x => x.Status).IsRequired().HasMaxLength(30);
        b.Property(x => x.ErrorMessage).HasMaxLength(1000);
        b.Property(x => x.StartedAt).HasColumnType("datetime2");
        b.Property(x => x.CompletedAt).HasColumnType("datetime2");
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");

        b.HasIndex(x => new { x.PhotoGalleryId, x.CreatedAt });

        b.HasOne(x => x.Gallery).WithMany()
            .HasForeignKey(x => x.PhotoGalleryId).OnDelete(DeleteBehavior.Cascade);

        b.ToTable(t =>
        {
            t.HasCheckConstraint("CK_PhotoCopyJobs_Status", CheckConstraintSql.In("Status", ImportJobStatuses.All));
            t.HasCheckConstraint("CK_PhotoCopyJobs_Kind", CheckConstraintSql.In("Kind", CopyJobKinds.All));
        });
    }
}

public class PhotoSelectionCopyConfiguration : IEntityTypeConfiguration<PhotoSelectionCopy>
{
    public void Configure(EntityTypeBuilder<PhotoSelectionCopy> b)
    {
        b.HasKey(x => x.PhotoSelectionCopyId);
        b.Property(x => x.DestinationPath).IsRequired().HasMaxLength(1500);
        b.Property(x => x.CreatedAt).HasColumnType("datetime2");

        // A photo has at most one generated copy at a time (it is in Normal or Big Size, never both).
        b.HasIndex(x => x.PhotoId).IsUnique();
        b.HasIndex(x => x.PhotoGalleryId);

        b.HasOne(x => x.Photo).WithMany()
            .HasForeignKey(x => x.PhotoId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Gallery).WithMany()
            .HasForeignKey(x => x.PhotoGalleryId).OnDelete(DeleteBehavior.Restrict);

        b.ToTable(t => t.HasCheckConstraint("CK_PhotoSelectionCopies_SelectionType", "[SelectionType] IN (1, 2)"));
    }
}
