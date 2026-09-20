using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudioManagement.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSelectionCopies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SourceFolder",
                table: "Photos",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SelectionCreatedAt",
                table: "PhotoGalleries",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SelectionSyncedAt",
                table: "PhotoGalleries",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PhotoCopyJobs",
                columns: table => new
                {
                    PhotoCopyJobId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PhotoGalleryId = table.Column<int>(type: "int", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    TotalCount = table.Column<int>(type: "int", nullable: false),
                    NormalCount = table.Column<int>(type: "int", nullable: false),
                    BigCount = table.Column<int>(type: "int", nullable: false),
                    ProcessedCount = table.Column<int>(type: "int", nullable: false),
                    CreatedCount = table.Column<int>(type: "int", nullable: false),
                    ExistsCount = table.Column<int>(type: "int", nullable: false),
                    RemovedCount = table.Column<int>(type: "int", nullable: false),
                    FailedCount = table.Column<int>(type: "int", nullable: false),
                    ErrorMessage = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhotoCopyJobs", x => x.PhotoCopyJobId);
                    table.CheckConstraint("CK_PhotoCopyJobs_Kind", "[Kind] IN ('Create','Sync')");
                    table.CheckConstraint("CK_PhotoCopyJobs_Status", "[Status] IN ('Queued','Running','Completed','CompletedWithErrors','Failed')");
                    table.ForeignKey(
                        name: "FK_PhotoCopyJobs_PhotoGalleries_PhotoGalleryId",
                        column: x => x.PhotoGalleryId,
                        principalTable: "PhotoGalleries",
                        principalColumn: "PhotoGalleryId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PhotoSelectionCopies",
                columns: table => new
                {
                    PhotoSelectionCopyId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PhotoGalleryId = table.Column<int>(type: "int", nullable: false),
                    PhotoId = table.Column<int>(type: "int", nullable: false),
                    SelectionType = table.Column<int>(type: "int", nullable: false),
                    DestinationPath = table.Column<string>(type: "nvarchar(1500)", maxLength: 1500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhotoSelectionCopies", x => x.PhotoSelectionCopyId);
                    table.CheckConstraint("CK_PhotoSelectionCopies_SelectionType", "[SelectionType] IN (1, 2)");
                    table.ForeignKey(
                        name: "FK_PhotoSelectionCopies_PhotoGalleries_PhotoGalleryId",
                        column: x => x.PhotoGalleryId,
                        principalTable: "PhotoGalleries",
                        principalColumn: "PhotoGalleryId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PhotoSelectionCopies_Photos_PhotoId",
                        column: x => x.PhotoId,
                        principalTable: "Photos",
                        principalColumn: "PhotoId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PhotoCopyJobs_PhotoGalleryId_CreatedAt",
                table: "PhotoCopyJobs",
                columns: new[] { "PhotoGalleryId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PhotoSelectionCopies_PhotoGalleryId",
                table: "PhotoSelectionCopies",
                column: "PhotoGalleryId");

            migrationBuilder.CreateIndex(
                name: "IX_PhotoSelectionCopies_PhotoId",
                table: "PhotoSelectionCopies",
                column: "PhotoId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PhotoCopyJobs");

            migrationBuilder.DropTable(
                name: "PhotoSelectionCopies");

            migrationBuilder.DropColumn(
                name: "SourceFolder",
                table: "Photos");

            migrationBuilder.DropColumn(
                name: "SelectionCreatedAt",
                table: "PhotoGalleries");

            migrationBuilder.DropColumn(
                name: "SelectionSyncedAt",
                table: "PhotoGalleries");
        }
    }
}
