using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace StudioManagement.Business.PhotoSelection;

// Encrypts the customer link token at rest (AES-256-GCM, key derived from the app's existing
// Jwt:Key) so the owner can copy or resend the same link later. Lookup still goes through the
// SHA-256 hash; this is only ever decrypted for an authenticated owner of the gallery's studio.
public interface ILinkTokenProtector
{
    string Protect(string rawToken);
    string? Unprotect(string? protectedToken);
}

public class LinkTokenProtector(IConfiguration configuration) : ILinkTokenProtector
{
    private const int NonceSize = 12;
    private const int TagSize = 16;

    private byte[] Key
    {
        get
        {
            var secret = configuration["Jwt:Key"]
                ?? throw new InvalidOperationException("Jwt:Key is not configured.");
            return SHA256.HashData(Encoding.UTF8.GetBytes("photo-gallery-link:" + secret));
        }
    }

    public string Protect(string rawToken)
    {
        var plaintext = Encoding.UTF8.GetBytes(rawToken);
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var cipher = new byte[plaintext.Length];
        var tag = new byte[TagSize];

        using var aes = new AesGcm(Key, TagSize);
        aes.Encrypt(nonce, plaintext, cipher, tag);

        return Convert.ToBase64String([.. nonce, .. tag, .. cipher]);
    }

    public string? Unprotect(string? protectedToken)
    {
        if (string.IsNullOrWhiteSpace(protectedToken))
        {
            return null;
        }

        try
        {
            var data = Convert.FromBase64String(protectedToken);
            var nonce = data[..NonceSize];
            var tag = data[NonceSize..(NonceSize + TagSize)];
            var cipher = data[(NonceSize + TagSize)..];
            var plaintext = new byte[cipher.Length];

            using var aes = new AesGcm(Key, TagSize);
            aes.Decrypt(nonce, cipher, tag, plaintext);
            return Encoding.UTF8.GetString(plaintext);
        }
        catch (Exception ex) when (ex is CryptographicException or FormatException or ArgumentException)
        {
            // Key changed or value corrupt — the owner just regenerates the link.
            return null;
        }
    }
}
