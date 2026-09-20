using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudioManagement.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPhotoGallery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PhotoGalleries",
                columns: table => new
                {
                    PhotoGalleryId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    StudioId = table.Column<int>(type: "int", nullable: false),
                    CustomerId = table.Column<int>(type: "int", nullable: false),
                    EventId = table.Column<int>(type: "int", nullable: false),
                    SourceFolder = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    TokenHash = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    TokenProtected = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsLinkActive = table.Column<bool>(type: "bit", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    LinkGeneratedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    FirstOpenedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastSelectionAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PreviewsPurgedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhotoGalleries", x => x.PhotoGalleryId);
                    table.CheckConstraint("CK_PhotoGalleries_Status", "[Status] IN ('Open','Locked')");
                    table.ForeignKey(
                        name: "FK_PhotoGalleries_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "CustomerId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PhotoGalleries_Events_EventId",
                        column: x => x.EventId,
                        principalTable: "Events",
                        principalColumn: "EventId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PhotoGalleries_Studios_StudioId",
                        column: x => x.StudioId,
                        principalTable: "Studios",
                        principalColumn: "StudioId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PhotoImportJobs",
                columns: table => new
                {
                    PhotoImportJobId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PhotoGalleryId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    SourceFolder = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    TotalCount = table.Column<int>(type: "int", nullable: false),
                    ProcessedCount = table.Column<int>(type: "int", nullable: false),
                    FailedCount = table.Column<int>(type: "int", nullable: false),
                    ErrorMessage = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhotoImportJobs", x => x.PhotoImportJobId);
                    table.CheckConstraint("CK_PhotoImportJobs_Status", "[Status] IN ('Queued','Running','Completed','CompletedWithErrors','Failed')");
                    table.ForeignKey(
                        name: "FK_PhotoImportJobs_PhotoGalleries_PhotoGalleryId",
                        column: x => x.PhotoGalleryId,
                        principalTable: "PhotoGalleries",
                        principalColumn: "PhotoGalleryId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Photos",
                columns: table => new
                {
                    PhotoId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PhotoGalleryId = table.Column<int>(type: "int", nullable: false),
                    PhotoNumber = table.Column<int>(type: "int", nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    SourceRelativePath = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    ThumbnailPath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    PreviewPath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Width = table.Column<int>(type: "int", nullable: false),
                    Height = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Photos", x => x.PhotoId);
                    table.ForeignKey(
                        name: "FK_Photos_PhotoGalleries_PhotoGalleryId",
                        column: x => x.PhotoGalleryId,
                        principalTable: "PhotoGalleries",
                        principalColumn: "PhotoGalleryId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PhotoSelections",
                columns: table => new
                {
                    PhotoSelectionId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PhotoGalleryId = table.Column<int>(type: "int", nullable: false),
                    PhotoId = table.Column<int>(type: "int", nullable: false),
                    SelectionType = table.Column<int>(type: "int", nullable: false),
                    SelectedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhotoSelections", x => x.PhotoSelectionId);
                    table.CheckConstraint("CK_PhotoSelections_SelectionType", "[SelectionType] IN (1, 2)");
                    table.ForeignKey(
                        name: "FK_PhotoSelections_PhotoGalleries_PhotoGalleryId",
                        column: x => x.PhotoGalleryId,
                        principalTable: "PhotoGalleries",
                        principalColumn: "PhotoGalleryId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PhotoSelections_Photos_PhotoId",
                        column: x => x.PhotoId,
                        principalTable: "Photos",
                        principalColumn: "PhotoId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PhotoGalleries_CustomerId",
                table: "PhotoGalleries",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_PhotoGalleries_EventId",
                table: "PhotoGalleries",
                column: "EventId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PhotoGalleries_StudioId_CustomerId",
                table: "PhotoGalleries",
                columns: new[] { "StudioId", "CustomerId" });

            migrationBuilder.CreateIndex(
                name: "IX_PhotoGalleries_TokenHash",
                table: "PhotoGalleries",
                column: "TokenHash",
                unique: true,
                filter: "[TokenHash] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PhotoImportJobs_PhotoGalleryId_CreatedAt",
                table: "PhotoImportJobs",
                columns: new[] { "PhotoGalleryId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Photos_PhotoGalleryId_FileName",
                table: "Photos",
                columns: new[] { "PhotoGalleryId", "FileName" });

            migrationBuilder.CreateIndex(
                name: "IX_Photos_PhotoGalleryId_PhotoNumber",
                table: "Photos",
                columns: new[] { "PhotoGalleryId", "PhotoNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PhotoSelections_PhotoGalleryId_SelectionType",
                table: "PhotoSelections",
                columns: new[] { "PhotoGalleryId", "SelectionType" });

            migrationBuilder.CreateIndex(
                name: "IX_PhotoSelections_PhotoId",
                table: "PhotoSelections",
                column: "PhotoId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PhotoImportJobs");

            migrationBuilder.DropTable(
                name: "PhotoSelections");

            migrationBuilder.DropTable(
                name: "Photos");

            migrationBuilder.DropTable(
                name: "PhotoGalleries");
        }
    }
}
