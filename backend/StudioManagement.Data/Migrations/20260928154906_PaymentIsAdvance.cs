using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudioManagement.Data.Migrations
{
    /// <inheritdoc />
    public partial class PaymentIsAdvance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsAdvance",
                table: "Payments",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Advances recorded before this column existed carry the note the booking form writes.
            migrationBuilder.Sql("UPDATE Payments SET IsAdvance = 1 WHERE Notes = N'Advance recorded when the event was booked'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsAdvance",
                table: "Payments");
        }
    }
}
