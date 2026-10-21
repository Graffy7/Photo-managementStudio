using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudioManagement.Data.Migrations
{
    /// <inheritdoc />
    public partial class EventStatusOngoing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Events_EventStatus",
                table: "Events");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Events_EventStatus",
                table: "Events",
                sql: "[EventStatus] IN ('Upcoming','Ongoing','Confirmed','Completed','Cancelled')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Events_EventStatus",
                table: "Events");

            // Ongoing doesn't exist before this migration; those events go back to Upcoming.
            migrationBuilder.Sql("UPDATE [Events] SET [EventStatus] = 'Upcoming' WHERE [EventStatus] = 'Ongoing'");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Events_EventStatus",
                table: "Events",
                sql: "[EventStatus] IN ('Upcoming','Confirmed','Completed','Cancelled')");
        }
    }
}
