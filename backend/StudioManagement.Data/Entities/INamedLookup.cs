namespace StudioManagement.Data.Entities;

// Shared shape for the simple, studio-managed dropdown tables (EventTypes, LeadSources,
// LeadStatuses, WorkerTypes, and future ones like ExpenseCategories) — lets one generic
// LookupService<T> serve all of them instead of near-duplicate services per table.
public interface INamedLookup
{
    string Name { get; set; }
    bool IsActive { get; set; }
    int DisplayOrder { get; set; }
    DateTime CreatedAt { get; set; }
    DateTime UpdatedAt { get; set; }
}
