using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudioManagement.Data.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceRefundedWithPendingPaymentStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Payments_PaymentStatus",
                table: "Payments");

            // "Refunded" no longer exists as a status — any payment previously marked that way
            // becomes "Pending" so it satisfies the new constraint below.
            migrationBuilder.Sql("UPDATE Payments SET PaymentStatus = 'Pending' WHERE PaymentStatus = 'Refunded';");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Payments_PaymentStatus",
                table: "Payments",
                sql: "[PaymentStatus] IN ('Completed','Cancelled','Pending')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Payments_PaymentStatus",
                table: "Payments");

            // Best-effort reversal — any payment marked "Pending" reverts to "Refunded" so it
            // satisfies the restored constraint, since this direction can't distinguish a
            // genuinely new "Pending" payment from one that used to be "Refunded".
            migrationBuilder.Sql("UPDATE Payments SET PaymentStatus = 'Refunded' WHERE PaymentStatus = 'Pending';");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Payments_PaymentStatus",
                table: "Payments",
                sql: "[PaymentStatus] IN ('Completed','Cancelled','Refunded')");
        }
    }
}
