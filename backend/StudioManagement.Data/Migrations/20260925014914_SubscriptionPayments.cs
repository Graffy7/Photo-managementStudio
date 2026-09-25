using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace StudioManagement.Data.Migrations
{
    /// <inheritdoc />
    public partial class SubscriptionPayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_SubscriptionPlans_PlanType",
                table: "SubscriptionPlans");

            migrationBuilder.AddColumn<int>(
                name: "DurationMonths",
                table: "SubscriptionPlans",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "PaymentGatewayEvents",
                columns: table => new
                {
                    PaymentGatewayEventId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Gateway = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    EventId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EventType = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    GatewayOrderId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    GatewayPaymentId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Outcome = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ReceivedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentGatewayEvents", x => x.PaymentGatewayEventId);
                });

            migrationBuilder.CreateTable(
                name: "SubscriptionOrders",
                columns: table => new
                {
                    SubscriptionOrderId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    StudioId = table.Column<int>(type: "int", nullable: false),
                    SubscriptionPlanId = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    Months = table.Column<int>(type: "int", nullable: false),
                    Gateway = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    GatewayOrderId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    GatewayPaymentId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PaymentMethod = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    FailureReason = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    SubscriptionPaymentId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PaidAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubscriptionOrders", x => x.SubscriptionOrderId);
                    table.CheckConstraint("CK_SubscriptionOrders_Status", "[Status] IN ('Created','Paid','Failed')");
                    table.ForeignKey(
                        name: "FK_SubscriptionOrders_Studios_StudioId",
                        column: x => x.StudioId,
                        principalTable: "Studios",
                        principalColumn: "StudioId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SubscriptionOrders_SubscriptionPayments_SubscriptionPaymentId",
                        column: x => x.SubscriptionPaymentId,
                        principalTable: "SubscriptionPayments",
                        principalColumn: "SubscriptionPaymentId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SubscriptionOrders_SubscriptionPlans_SubscriptionPlanId",
                        column: x => x.SubscriptionPlanId,
                        principalTable: "SubscriptionPlans",
                        principalColumn: "SubscriptionPlanId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "SubscriptionPlanId",
                keyValue: 1,
                columns: new[] { "Description", "DurationMonths", "Price" },
                values: new object[] { "1 month of full access.", 1, 599m });

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "SubscriptionPlanId",
                keyValue: 2,
                columns: new[] { "Description", "DurationMonths", "Price" },
                values: new object[] { "12 months of full access — the best value.", 12, 5500m });

            migrationBuilder.InsertData(
                table: "SubscriptionPlans",
                columns: new[] { "SubscriptionPlanId", "CreatedAt", "Description", "DurationInDays", "DurationMonths", "IsActive", "PlanName", "PlanType", "Price", "UpdatedAt" },
                values: new object[,]
                {
                    { 3, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "3 months of full access.", 91, 3, true, "Quarterly", "Quarterly", 1600m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 4, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "6 months of full access.", 182, 6, true, "Half-Yearly", "HalfYearly", 3000m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) }
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_SubscriptionPlans_PlanType",
                table: "SubscriptionPlans",
                sql: "[PlanType] IN ('Monthly','Quarterly','HalfYearly','Yearly','Custom')");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentGatewayEvents_Gateway_EventId",
                table: "PaymentGatewayEvents",
                columns: new[] { "Gateway", "EventId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionOrders_GatewayOrderId",
                table: "SubscriptionOrders",
                column: "GatewayOrderId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionOrders_GatewayPaymentId",
                table: "SubscriptionOrders",
                column: "GatewayPaymentId",
                unique: true,
                filter: "[GatewayPaymentId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionOrders_StudioId_CreatedAt",
                table: "SubscriptionOrders",
                columns: new[] { "StudioId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionOrders_SubscriptionPaymentId",
                table: "SubscriptionOrders",
                column: "SubscriptionPaymentId",
                unique: true,
                filter: "[SubscriptionPaymentId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionOrders_SubscriptionPlanId",
                table: "SubscriptionOrders",
                column: "SubscriptionPlanId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PaymentGatewayEvents");

            migrationBuilder.DropTable(
                name: "SubscriptionOrders");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SubscriptionPlans_PlanType",
                table: "SubscriptionPlans");

            migrationBuilder.DeleteData(
                table: "SubscriptionPlans",
                keyColumn: "SubscriptionPlanId",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "SubscriptionPlans",
                keyColumn: "SubscriptionPlanId",
                keyValue: 4);

            migrationBuilder.DropColumn(
                name: "DurationMonths",
                table: "SubscriptionPlans");

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "SubscriptionPlanId",
                keyValue: 1,
                columns: new[] { "Description", "Price" },
                values: new object[] { "Billed every month.", 999m });

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "SubscriptionPlanId",
                keyValue: 2,
                columns: new[] { "Description", "Price" },
                values: new object[] { "Billed once a year — two months free versus Monthly.", 9999m });

            migrationBuilder.AddCheckConstraint(
                name: "CK_SubscriptionPlans_PlanType",
                table: "SubscriptionPlans",
                sql: "[PlanType] IN ('Monthly','Yearly','Custom')");
        }
    }
}
