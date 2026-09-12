using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudioManagement.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddStudioProfileAndLastLogin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Events_EventStatus",
                table: "Events");

            migrationBuilder.AddColumn<DateTime>(
                name: "LastLoginAt",
                table: "Users",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "Studios",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GstNumber",
                table: "Studios",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LogoUrl",
                table: "Studios",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Pincode",
                table: "Studios",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "State",
                table: "Studios",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Website",
                table: "Studios",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Events_EventStatus",
                table: "Events",
                sql: "[EventStatus] IN ('Upcoming','Confirmed','Completed','Cancelled')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Events_EventStatus",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "LastLoginAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "City",
                table: "Studios");

            migrationBuilder.DropColumn(
                name: "GstNumber",
                table: "Studios");

            migrationBuilder.DropColumn(
                name: "LogoUrl",
                table: "Studios");

            migrationBuilder.DropColumn(
                name: "Pincode",
                table: "Studios");

            migrationBuilder.DropColumn(
                name: "State",
                table: "Studios");

            migrationBuilder.DropColumn(
                name: "Website",
                table: "Studios");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Events_EventStatus",
                table: "Events",
                sql: "[EventStatus] IN ('Upcoming','Confirmed','InProgress','Completed','Cancelled')");
        }
    }
}
