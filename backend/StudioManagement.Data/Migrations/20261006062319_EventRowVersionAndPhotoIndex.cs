using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudioManagement.Data.Migrations
{
    /// <inheritdoc />
    public partial class EventRowVersionAndPhotoIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A version stamp SQL Server maintains itself (existing rows get one automatically); the
            // event edit form uses it to detect that someone else saved first.
            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "Events",
                type: "rowversion",
                rowVersion: true,
                nullable: false);

            migrationBuilder.CreateIndex(
                name: "IX_Photos_PhotoGalleryId_IsActive",
                table: "Photos",
                columns: new[] { "PhotoGalleryId", "IsActive" })
                .Annotation("SqlServer:Include", new[] { "PhotoNumber", "FileName", "PhotoFolderId", "ThumbnailPath", "PreviewPath", "Width", "Height" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Photos_PhotoGalleryId_IsActive",
                table: "Photos");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "Events");
        }
    }
}
