using System.Linq.Expressions;

namespace StudioManagement.Data.Common;

// Which column a list is sorted by, as chosen on screen. Each repository maps the names it knows
// ("date", "customer", ...) to a real column; anything else falls back to the list's usual order,
// so nothing from the request ever reaches the query as text.
public record ListSort(string? By, bool Descending)
{
    public string Key => (By ?? "").Trim().ToLowerInvariant();
}

public static class ListSortExtensions
{
    public static IOrderedQueryable<T> OrderByDirection<T, TKey>(this IQueryable<T> query, Expression<Func<T, TKey>> key, bool descending) =>
        descending ? query.OrderByDescending(key) : query.OrderBy(key);
}
