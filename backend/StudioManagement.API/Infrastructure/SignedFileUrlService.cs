using System.Security.Cryptography;
using System.Text;
using StudioManagement.Business.Storage;

namespace StudioManagement.API.Infrastructure;

// File links look like /media/photo-gallery/12/ab34.webp?exp=1790000000&sig=Xy..., where sig is an
// HMAC of the key and the expiry. Only the server can make one, changing any part breaks it, and it
// stops working at exp. The expiry is rounded up to a 6-hour step, so the same photo keeps the same
// link for a while and browsers can cache it.
public class SignedFileUrlService : IFileUrlService
{
    public const string RoutePrefix = "/media/";
    private const long StepSeconds = 6 * 3600;

    private readonly byte[] secret;
    private readonly long lifetimeSeconds;
    private readonly TimeProvider clock;

    public SignedFileUrlService(StorageOptions options, IConfiguration configuration, TimeProvider clock)
    {
        var configured = options.UrlSigningKey;
        if (string.IsNullOrWhiteSpace(configured))
        {
            var jwtKey = configuration["Jwt:Key"] ?? throw new InvalidOperationException("Set Storage:UrlSigningKey (or Jwt:Key) to sign file links.");
            configured = "file-links|" + jwtKey;
        }
        secret = SHA256.HashData(Encoding.UTF8.GetBytes(configured));
        lifetimeSeconds = Math.Clamp(options.SignedUrlHours, 1, 24 * 30) * 3600L;
        this.clock = clock;
    }

    public string? GetUrl(string? key)
    {
        var clean = StorageKey.Normalize(key);
        if (clean is null)
        {
            return null;
        }
        var now = clock.GetUtcNow().ToUnixTimeSeconds();
        var expires = (now + lifetimeSeconds + StepSeconds - 1) / StepSeconds * StepSeconds;
        return $"{RoutePrefix}{clean}?exp={expires}&sig={Sign(clean, expires)}";
    }

    // True when the link was made by this server for this key and hasn't expired.
    public bool IsValid(string key, long expires, string? signature)
    {
        var now = clock.GetUtcNow().ToUnixTimeSeconds();
        if (string.IsNullOrEmpty(signature) || expires <= now || expires > now + lifetimeSeconds + StepSeconds)
        {
            return false;
        }
        var expected = Encoding.ASCII.GetBytes(Sign(key, expires));
        var given = Encoding.ASCII.GetBytes(signature);
        return CryptographicOperations.FixedTimeEquals(expected, given);
    }

    public long SecondsLeft(long expires) => Math.Max(0, expires - clock.GetUtcNow().ToUnixTimeSeconds());

    private string Sign(string key, long expires)
    {
        var mac = HMACSHA256.HashData(secret, Encoding.UTF8.GetBytes($"{key}\n{expires}"));
        return Convert.ToBase64String(mac).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
