using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class StudioSettingRepository(AppDbContext context) : IStudioSettingRepository
{
    public Task<List<StudioSetting>> GetAllForStudioAsync(int studioId, CancellationToken ct = default) =>
        context.StudioSettings.AsNoTracking().Where(s => s.StudioId == studioId).ToListAsync(ct);

    public async Task UpsertManyAsync(int studioId, Dictionary<string, string?> values, CancellationToken ct = default)
    {
        var keys = values.Keys.ToList();
        var existing = await context.StudioSettings
            .Where(s => s.StudioId == studioId && keys.Contains(s.SettingKey))
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        foreach (var (key, value) in values)
        {
            var row = existing.FirstOrDefault(s => s.SettingKey == key);
            if (row is null)
            {
                context.StudioSettings.Add(new StudioSetting
                {
                    StudioId = studioId,
                    SettingKey = key,
                    SettingValue = value,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            }
            else
            {
                row.SettingValue = value;
                row.UpdatedAt = now;
            }
        }

        await context.SaveChangesAsync(ct);
    }
}
