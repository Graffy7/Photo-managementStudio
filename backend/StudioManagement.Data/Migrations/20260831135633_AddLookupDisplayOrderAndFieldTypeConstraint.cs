using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudioManagement.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLookupDisplayOrderAndFieldTypeConstraint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DisplayOrder",
                table: "WorkerTypes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "DisplayOrder",
                table: "LeadSources",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "DisplayOrder",
                table: "EventTypes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddCheckConstraint(
                name: "CK_FormFields_FieldType",
                table: "FormFields",
                sql: "[FieldType] IN ('TEXT','TEXTAREA','NUMBER','DATE','DATETIME','DROPDOWN','MULTISELECT','CHECKBOX','RADIO','SWITCH','EMAIL','PHONE')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_FormFields_FieldType",
                table: "FormFields");

            migrationBuilder.DropColumn(
                name: "DisplayOrder",
                table: "WorkerTypes");

            migrationBuilder.DropColumn(
                name: "DisplayOrder",
                table: "LeadSources");

            migrationBuilder.DropColumn(
                name: "DisplayOrder",
                table: "EventTypes");
        }
    }
}
