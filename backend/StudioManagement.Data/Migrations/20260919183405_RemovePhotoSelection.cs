using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudioManagement.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemovePhotoSelection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Notifications raised by the removed module would otherwise linger with no screen to open.
            migrationBuilder.Sql("DELETE FROM Notifications WHERE NotificationType = 'PhotoSelectionSubmitted'");

            migrationBuilder.DropTable(
                name: "PhotoProcessingJobItems");

            migrationBuilder.DropTable(
                name: "PhotoSelectionActivities");

            migrationBuilder.DropTable(
                name: "PhotoProcessingJobs");

            migrationBuilder.DropTable(
                name: "Photos");

            migrationBuilder.DropTable(
                name: "PhotoSelectionProjects");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PhotoSelectionProjects",
                columns: table => new
                {
                    PhotoSelectionProjectId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CustomerId = table.Column<int>(type: "int", nullable: false),
                    EventId = table.Column<int>(type: "int", nullable: true),
                    StudioId = table.Column<int>(type: "int", nullable: false),
                    AccessTokenHash = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DestinationRootFolder = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    FirstOpenedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    LinkGeneratedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    PinHash = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ProcessedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReopenedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SelectionLimitBig = table.Column<int>(type: "int", nullable: true),
                    SelectionLimitNormal = table.Column<int>(type: "int", nullable: true),
                    SelectionLimitTotal = table.Column<int>(type: "int", nullable: true),
                    SelectionStartedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SourceFolder = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TokenExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhotoSelectionProjects", x => x.PhotoSelectionProjectId);
                    table.CheckConstraint("CK_PhotoSelectionProjects_Status", "[Status] IN ('Draft','LinkGenerated','InProgress','Submitted','Reopened','Processed')");
                    table.ForeignKey(
                        name: "FK_PhotoSelectionProjects_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "CustomerId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PhotoSelectionProjects_Events_EventId",
                        column: x => x.EventId,
                        principalTable: "Events",
                        principalColumn: "EventId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PhotoSelectionProjects_Studios_StudioId",
                        column: x => x.StudioId,
                        principalTable: "Studios",
                        principalColumn: "StudioId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PhotoProcessingJobs",
                columns: table => new
                {
                    PhotoProcessingJobId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PhotoSelectionProjectId = table.Column<int>(type: "int", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedCount = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FailedCount = table.Column<int>(type: "int", nullable: false),
                    MissingCount = table.Column<int>(type: "int", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    TotalCount = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhotoProcessingJobs", x => x.PhotoProcessingJobId);
                    table.CheckConstraint("CK_PhotoProcessingJobs_Status", "[Status] IN ('Pending','Running','Completed','CompletedWithErrors','Failed')");
                    table.ForeignKey(
                        name: "FK_PhotoProcessingJobs_PhotoSelectionProjects_PhotoSelectionProjectId",
                        column: x => x.PhotoSelectionProjectId,
                        principalTable: "PhotoSelectionProjects",
                        principalColumn: "PhotoSelectionProjectId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Photos",
                columns: table => new
                {
                    PhotoId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PhotoSelectionProjectId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsSelected = table.Column<bool>(type: "bit", nullable: false),
                    OriginalFileName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    PhotoNumber = table.Column<int>(type: "int", nullable: false),
                    PreviewPath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    RelativePath = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    SelectedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SelectionType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ThumbnailPath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Photos", x => x.PhotoId);
                    table.CheckConstraint("CK_Photos_SelectionType", "[SelectionType] IN ('None','Normal','Big')");
                    table.ForeignKey(
                        name: "FK_Photos_PhotoSelectionProjects_PhotoSelectionProjectId",
                        column: x => x.PhotoSelectionProjectId,
                        principalTable: "PhotoSelectionProjects",
                        principalColumn: "PhotoSelectionProjectId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PhotoProcessingJobItems",
                columns: table => new
                {
                    PhotoProcessingJobItemId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PhotoId = table.Column<int>(type: "int", nullable: false),
                    PhotoProcessingJobId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ErrorMessage = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Result = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhotoProcessingJobItems", x => x.PhotoProcessingJobItemId);
                    table.CheckConstraint("CK_PhotoProcessingJobItems_Result", "[Result] IN ('Copied','Missing','Failed')");
                    table.ForeignKey(
                        name: "FK_PhotoProcessingJobItems_PhotoProcessingJobs_PhotoProcessingJobId",
                        column: x => x.PhotoProcessingJobId,
                        principalTable: "PhotoProcessingJobs",
                        principalColumn: "PhotoProcessingJobId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PhotoProcessingJobItems_Photos_PhotoId",
                        column: x => x.PhotoId,
                        principalTable: "Photos",
                        principalColumn: "PhotoId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PhotoSelectionActivities",
                columns: table => new
                {
                    PhotoSelectionActivityId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PhotoId = table.Column<int>(type: "int", nullable: true),
                    PhotoSelectionProjectId = table.Column<int>(type: "int", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    NewSelectionType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    OldSelectionType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhotoSelectionActivities", x => x.PhotoSelectionActivityId);
                    table.ForeignKey(
                        name: "FK_PhotoSelectionActivities_PhotoSelectionProjects_PhotoSelectionProjectId",
                        column: x => x.PhotoSelectionProjectId,
                        principalTable: "PhotoSelectionProjects",
                        principalColumn: "PhotoSelectionProjectId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PhotoSelectionActivities_Photos_PhotoId",
                        column: x => x.PhotoId,
                        principalTable: "Photos",
                        principalColumn: "PhotoId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PhotoProcessingJobItems_PhotoId",
                table: "PhotoProcessingJobItems",
                column: "PhotoId");

            migrationBuilder.CreateIndex(
                name: "IX_PhotoProcessingJobItems_PhotoProcessingJobId",
                table: "PhotoProcessingJobItems",
                column: "PhotoProcessingJobId");

            migrationBuilder.CreateIndex(
                name: "IX_PhotoProcessingJobs_PhotoSelectionProjectId",
                table: "PhotoProcessingJobs",
                column: "PhotoSelectionProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_Photos_PhotoSelectionProjectId_PhotoNumber",
                table: "Photos",
                columns: new[] { "PhotoSelectionProjectId", "PhotoNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Photos_PhotoSelectionProjectId_SelectionType",
                table: "Photos",
                columns: new[] { "PhotoSelectionProjectId", "SelectionType" });

            migrationBuilder.CreateIndex(
                name: "IX_PhotoSelectionActivities_PhotoId",
                table: "PhotoSelectionActivities",
                column: "PhotoId");

            migrationBuilder.CreateIndex(
                name: "IX_PhotoSelectionActivities_PhotoSelectionProjectId_CreatedAt",
                table: "PhotoSelectionActivities",
                columns: new[] { "PhotoSelectionProjectId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PhotoSelectionProjects_AccessTokenHash",
                table: "PhotoSelectionProjects",
                column: "AccessTokenHash",
                unique: true,
                filter: "[AccessTokenHash] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PhotoSelectionProjects_CustomerId",
                table: "PhotoSelectionProjects",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_PhotoSelectionProjects_EventId",
                table: "PhotoSelectionProjects",
                column: "EventId");

            migrationBuilder.CreateIndex(
                name: "IX_PhotoSelectionProjects_StudioId_CustomerId",
                table: "PhotoSelectionProjects",
                columns: new[] { "StudioId", "CustomerId" });
        }
    }
}
