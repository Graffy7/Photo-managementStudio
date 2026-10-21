using System.Text.RegularExpressions;
using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.Studios;

// The parts of a studio's profile that customers see but that the Studios table has no column for
// (WhatsApp number, a short description, social links). They are kept as per-studio settings
// ("Profile.*" keys in StudioSettings), so no database change is needed and every value stays tied
// to its own StudioId.
public class StudioProfileExtrasDto
{
    public string? WhatsAppNumber { get; set; }
    public string? Description { get; set; }
    public string? InstagramUrl { get; set; }
    public string? FacebookUrl { get; set; }
}

// What the customer's photo-selection page shows about the studio that owns the gallery. Only
// filled-in values are sent; nothing private (owner name, GST, login email, address) is included.
public class StudioBrandDto
{
    public string Name { get; set; } = null!;
    public string? LogoUrl { get; set; }
    public string? Description { get; set; }
    public string? Phone { get; set; }
    // https://wa.me/<number> - a link, so the page never needs to build one itself.
    public string? WhatsAppUrl { get; set; }
    public string? Website { get; set; }
    public string? InstagramUrl { get; set; }
    public string? FacebookUrl { get; set; }
}

public interface IStudioProfileExtrasService
{
    Task<StudioProfileExtrasDto> GetAsync(int studioId, CancellationToken ct = default);
    Task SaveAsync(int studioId, StudioProfileExtrasDto extras, CancellationToken ct = default);
}

public class StudioProfileExtrasService(IStudioSettingRepository settings) : IStudioProfileExtrasService
{
    public const string WhatsAppKey = "Profile.WhatsAppNumber";
    public const string DescriptionKey = "Profile.Description";
    public const string InstagramKey = "Profile.InstagramUrl";
    public const string FacebookKey = "Profile.FacebookUrl";

    public async Task<StudioProfileExtrasDto> GetAsync(int studioId, CancellationToken ct = default)
    {
        var values = (await settings.GetAllForStudioAsync(studioId, ct))
            .ToDictionary(s => s.SettingKey, s => s.SettingValue, StringComparer.OrdinalIgnoreCase);
        string? Get(string key) => values.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v : null;
        return new StudioProfileExtrasDto
        {
            WhatsAppNumber = Get(WhatsAppKey),
            Description = Get(DescriptionKey),
            InstagramUrl = Get(InstagramKey),
            FacebookUrl = Get(FacebookKey)
        };
    }

    public Task SaveAsync(int studioId, StudioProfileExtrasDto extras, CancellationToken ct = default) =>
        settings.UpsertManyAsync(studioId, new Dictionary<string, string?>
        {
            [WhatsAppKey] = Clean(extras.WhatsAppNumber),
            [DescriptionKey] = Clean(extras.Description),
            [InstagramKey] = PublicLinks.NormalizeUrl(extras.InstagramUrl),
            [FacebookKey] = PublicLinks.NormalizeUrl(extras.FacebookUrl)
        }, ct);

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

// Checks for the contact details a studio shows publicly.
public static partial class PublicLinks
{
    // A web address that is safe to put behind a link: http(s) only, a real host name. "example.com"
    // becomes "https://example.com/". Null for blank or unusable input (javascript:, data:, "abc"...).
    public static string? NormalizeUrl(string? input)
    {
        var text = input?.Trim();
        if (string.IsNullOrEmpty(text) || text.Any(char.IsWhiteSpace))
        {
            return null;
        }
        if (!text.Contains("://", StringComparison.Ordinal))
        {
            text = "https://" + text;
        }
        if (!Uri.TryCreate(text, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)
            || !uri.Host.Contains('.') || uri.Host.StartsWith('.') || uri.Host.EndsWith('.')
            || !string.IsNullOrEmpty(uri.UserInfo))
        {
            return null;
        }
        return uri.AbsoluteUri;
    }

    public static bool IsValidUrl(string? input) => string.IsNullOrWhiteSpace(input) || NormalizeUrl(input) is not null;

    // Digits, spaces, "+", "-", "(", ")" only, with 7-15 digits in all.
    public static bool IsValidPhone(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return true;
        if (!PhoneChars().IsMatch(input.Trim())) return false;
        var digits = input.Count(char.IsDigit);
        return digits is >= 7 and <= 15;
    }

    // A WhatsApp number needs its country code (wa.me links don't work without one): 11-15 digits.
    public static bool IsValidWhatsApp(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return true;
        if (!PhoneChars().IsMatch(input.Trim())) return false;
        var digits = input.Count(char.IsDigit);
        return digits is >= 11 and <= 15;
    }

    public static string? WhatsAppUrl(string? number)
    {
        if (string.IsNullOrWhiteSpace(number) || !IsValidWhatsApp(number)) return null;
        var digits = new string(number.Where(char.IsDigit).ToArray()).TrimStart('0');
        return $"https://wa.me/{digits}";
    }

    [GeneratedRegex(@"^\+?[0-9 ()\-]+$")]
    private static partial Regex PhoneChars();
}
