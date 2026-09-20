using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudioManagement.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWhatsAppReminderLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WhatsAppReminderLogs",
                columns: table => new
                {
                    WhatsAppReminderLogId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    StudioId = table.Column<int>(type: "int", nullable: false),
                    EventId = table.Column<int>(type: "int", nullable: false),
                    ReminderDate = table.Column<DateTime>(type: "date", nullable: false),
                    ReminderType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    RecipientType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    WorkerId = table.Column<int>(type: "int", nullable: true),
                    RecipientKey = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    Detail = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SentAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WhatsAppReminderLogs", x => x.WhatsAppReminderLogId);
                    table.CheckConstraint("CK_WhatsAppReminderLogs_Recipient", "[RecipientType] IN ('Owner','Worker')");
                    table.CheckConstraint("CK_WhatsAppReminderLogs_Status", "[Status] IN ('Sent','Failed','Skipped')");
                    table.CheckConstraint("CK_WhatsAppReminderLogs_Type", "[ReminderType] IN ('TomorrowEvent','TomorrowPayment')");
                    table.ForeignKey(
                        name: "FK_WhatsAppReminderLogs_Events_EventId",
                        column: x => x.EventId,
                        principalTable: "Events",
                        principalColumn: "EventId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_WhatsAppReminderLogs_Studios_StudioId",
                        column: x => x.StudioId,
                        principalTable: "Studios",
                        principalColumn: "StudioId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WhatsAppReminderLogs_EventId_ReminderDate_ReminderType_RecipientKey",
                table: "WhatsAppReminderLogs",
                columns: new[] { "EventId", "ReminderDate", "ReminderType", "RecipientKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WhatsAppReminderLogs_StudioId_ReminderDate",
                table: "WhatsAppReminderLogs",
                columns: new[] { "StudioId", "ReminderDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WhatsAppReminderLogs");
        }
    }
}
