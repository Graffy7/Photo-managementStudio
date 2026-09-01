namespace StudioManagement.Business.Services;

public class ServiceCatalogDto
{
    public int ServiceId { get; set; }
    public string ServiceName { get; set; } = null!;
    public string? Description { get; set; }
    public decimal DefaultPrice { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateServiceRequestDto
{
    public string ServiceName { get; set; } = null!;
    public string? Description { get; set; }
    public decimal DefaultPrice { get; set; }
}

public class UpdateServiceRequestDto
{
    public string ServiceName { get; set; } = null!;
    public string? Description { get; set; }
    public decimal DefaultPrice { get; set; }
}
