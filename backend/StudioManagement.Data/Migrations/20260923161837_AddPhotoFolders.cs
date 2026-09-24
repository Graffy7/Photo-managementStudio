using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudioManagement.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPhotoFolders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PhotoFolderId",
                table: "Photos",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PhotoFolders",
                columns: table => new
                {
                    PhotoFolderId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    StudioId = table.Column<int>(type: "int", nullable: false),
                    PhotoGalleryId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsDelivered = table.Column<bool>(type: "bit", nullable: false),
                    DeliveredAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhotoFolders", x => x.PhotoFolderId);
                    table.ForeignKey(
                        name: "FK_PhotoFolders_PhotoGalleries_PhotoGalleryId",
                        column: x => x.PhotoGalleryId,
                        principalTable: "PhotoGalleries",
                        principalColumn: "PhotoGalleryId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PhotoFolders_Studios_StudioId",
                        column: x => x.StudioId,
                        principalTable: "Studios",
                        principalColumn: "StudioId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Photos_PhotoFolderId",
                table: "Photos",
                column: "PhotoFolderId");

            migrationBuilder.CreateIndex(
                name: "IX_PhotoFolders_PhotoGalleryId_Name",
                table: "PhotoFolders",
                columns: new[] { "PhotoGalleryId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PhotoFolders_StudioId",
                table: "PhotoFolders",
                column: "StudioId");

            migrationBuilder.AddForeignKey(
                name: "FK_Photos_PhotoFolders_PhotoFolderId",
                table: "Photos",
                column: "PhotoFolderId",
                principalTable: "PhotoFolders",
                principalColumn: "PhotoFolderId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Photos_PhotoFolders_PhotoFolderId",
                table: "Photos");

            migrationBuilder.DropTable(
                name: "PhotoFolders");

            migrationBuilder.DropIndex(
                name: "IX_Photos_PhotoFolderId",
                table: "Photos");

            migrationBuilder.DropColumn(
                name: "PhotoFolderId",
                table: "Photos");
        }
    }
}
