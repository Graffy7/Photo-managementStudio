namespace StudioManagement.Business.Lookups;

public class LookupDto
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public bool IsActive { get; set; }
    public int DisplayOrder { get; set; }
}

public class CreateLookupRequestDto
{
    public string Name { get; set; } = null!;
    public int? DisplayOrder { get; set; }
}

public class UpdateLookupRequestDto
{
    public string Name { get; set; } = null!;
    public bool IsActive { get; set; } = true;
    public int? DisplayOrder { get; set; }
}
