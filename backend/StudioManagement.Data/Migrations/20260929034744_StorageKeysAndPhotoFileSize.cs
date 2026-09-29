using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudioManagement.Data.Migrations
{
    /// <inheritdoc />
    public partial class StorageKeysAndPhotoFileSize : Migration
    {
        // Stored files used to be recorded by their public web path ("/uploads/<key>"). From now on the
        // database holds only the storage key ("<key>"); addresses are made when a screen needs one.
        private const string Prefix = "/uploads/";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "FileSize",
                table: "Photos",
                type: "bigint",
                nullable: true);

            migrationBuilder.Sql($"UPDATE Photos SET ThumbnailPath = SUBSTRING(ThumbnailPath, {Prefix.Length + 1}, 4000) WHERE ThumbnailPath LIKE N'{Prefix}%';");
            migrationBuilder.Sql($"UPDATE Photos SET PreviewPath = SUBSTRING(PreviewPath, {Prefix.Length + 1}, 4000) WHERE PreviewPath LIKE N'{Prefix}%';");
            migrationBuilder.Sql($"UPDATE Studios SET LogoUrl = SUBSTRING(LogoUrl, {Prefix.Length + 1}, 4000) WHERE LogoUrl LIKE N'{Prefix}%';");
            migrationBuilder.Sql($"UPDATE StudioSettings SET SettingValue = SUBSTRING(SettingValue, {Prefix.Length + 1}, 4000) WHERE SettingKey = N'Pdf.SignatureUrl' AND SettingValue LIKE N'{Prefix}%';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($"UPDATE Photos SET ThumbnailPath = N'{Prefix}' + ThumbnailPath WHERE ThumbnailPath IS NOT NULL AND ThumbnailPath NOT LIKE N'/%';");
            migrationBuilder.Sql($"UPDATE Photos SET PreviewPath = N'{Prefix}' + PreviewPath WHERE PreviewPath IS NOT NULL AND PreviewPath NOT LIKE N'/%';");
            migrationBuilder.Sql($"UPDATE Studios SET LogoUrl = N'{Prefix}' + LogoUrl WHERE LogoUrl IS NOT NULL AND LogoUrl <> N'' AND LogoUrl NOT LIKE N'/%';");
            migrationBuilder.Sql($"UPDATE StudioSettings SET SettingValue = N'{Prefix}' + SettingValue WHERE SettingKey = N'Pdf.SignatureUrl' AND SettingValue <> N'' AND SettingValue NOT LIKE N'/%';");

            migrationBuilder.DropColumn(
                name: "FileSize",
                table: "Photos");
        }
    }
}
