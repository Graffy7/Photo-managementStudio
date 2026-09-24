using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace StudioManagement.Data.Migrations
{
    /// <inheritdoc />
    public partial class SuperAdminConsole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PeriodEnd",
                table: "SubscriptionPayments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PeriodStart",
                table: "SubscriptionPayments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsTrial",
                table: "StudioSubscriptions",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Device",
                table: "AuditLogs",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IpAddress",
                table: "AuditLogs",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "StudioDailyUsages",
                columns: table => new
                {
                    StudioId = table.Column<int>(type: "int", nullable: false),
                    UsageDate = table.Column<DateTime>(type: "date", nullable: false),
                    ActiveMinutes = table.Column<int>(type: "int", nullable: false),
                    RequestCount = table.Column<int>(type: "int", nullable: false),
                    LastSeenAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudioDailyUsages", x => new { x.StudioId, x.UsageDate });
                    table.ForeignKey(
                        name: "FK_StudioDailyUsages_Studios_StudioId",
                        column: x => x.StudioId,
                        principalTable: "Studios",
                        principalColumn: "StudioId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Features",
                columns: new[] { "FeatureId", "CreatedAt", "Description", "FeatureCode", "FeatureName", "IsActive", "UpdatedAt" },
                values: new object[,]
                {
                    { 12, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "The studio's home dashboard with figures and charts.", "DASHBOARD", "Dashboard", true, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 13, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Import photos and manage customer selection.", "PHOTO_SELECTION", "Photo Selection", true, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 14, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Delivery folders and copying selected originals.", "PHOTO_DELIVERY", "Photo Delivery", true, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 15, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "WhatsApp sharing and automatic reminders.", "WHATSAPP", "WhatsApp", true, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 16, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "The customer's online photo gallery link.", "GALLERY", "Gallery", true, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 17, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Studio profile, branding and form settings.", "SETTINGS", "Settings", true, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StudioDailyUsages");

            migrationBuilder.DeleteData(
                table: "Features",
                keyColumn: "FeatureId",
                keyValue: 12);

            migrationBuilder.DeleteData(
                table: "Features",
                keyColumn: "FeatureId",
                keyValue: 13);

            migrationBuilder.DeleteData(
                table: "Features",
                keyColumn: "FeatureId",
                keyValue: 14);

            migrationBuilder.DeleteData(
                table: "Features",
                keyColumn: "FeatureId",
                keyValue: 15);

            migrationBuilder.DeleteData(
                table: "Features",
                keyColumn: "FeatureId",
                keyValue: 16);

            migrationBuilder.DeleteData(
                table: "Features",
                keyColumn: "FeatureId",
                keyValue: 17);

            migrationBuilder.DropColumn(
                name: "PeriodEnd",
                table: "SubscriptionPayments");

            migrationBuilder.DropColumn(
                name: "PeriodStart",
                table: "SubscriptionPayments");

            migrationBuilder.DropColumn(
                name: "IsTrial",
                table: "StudioSubscriptions");

            migrationBuilder.DropColumn(
                name: "Device",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "IpAddress",
                table: "AuditLogs");
        }
    }
}
