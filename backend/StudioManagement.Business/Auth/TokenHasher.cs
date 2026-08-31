using System.Security.Cryptography;
using System.Text;

namespace StudioManagement.Business.Auth;

public static class TokenHasher
{
    public static string GenerateRawToken() =>
        WebEncode(RandomNumberGenerator.GetBytes(32));

    public static string Hash(string rawToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToHexString(bytes);
    }

    private static string WebEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
}
