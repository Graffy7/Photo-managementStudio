using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudioManagement.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddEventDeliveryItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EventDeliveryItems",
                columns: table => new
                {
                    EventDeliveryItemId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    StudioId = table.Column<int>(type: "int", nullable: false),
                    EventId = table.Column<int>(type: "int", nullable: false),
                    ItemKey = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsDelivered = table.Column<bool>(type: "bit", nullable: false),
                    DeliveredAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventDeliveryItems", x => x.EventDeliveryItemId);
                    table.ForeignKey(
                        name: "FK_EventDeliveryItems_Events_EventId",
                        column: x => x.EventId,
                        principalTable: "Events",
                        principalColumn: "EventId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EventDeliveryItems_Studios_StudioId",
                        column: x => x.StudioId,
                        principalTable: "Studios",
                        principalColumn: "StudioId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EventDeliveryItems_EventId_ItemKey",
                table: "EventDeliveryItems",
                columns: new[] { "EventId", "ItemKey" },
                unique: true,
                filter: "[ItemKey] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_EventDeliveryItems_StudioId_EventId",
                table: "EventDeliveryItems",
                columns: new[] { "StudioId", "EventId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EventDeliveryItems");
        }
    }
}
