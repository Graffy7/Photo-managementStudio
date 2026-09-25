using Microsoft.Extensions.Caching.Memory;

namespace StudioManagement.Business.Auth;

// Brute-force protection for sign-in that counts *failed* attempts, so people sharing one office
// internet connection don't block each other:
//   - per account on one connection:   5 failures in 15 minutes -> that account waits (from there);
//   - per account from anywhere:       20 failures in 15 minutes -> that account waits everywhere
//                                       (stops guessing spread across many IPs);
//   - per connection, all accounts:    50 failures in 15 minutes -> that connection waits
//                                       (stops trying many accounts from one place).
// A correct password clears the account's own counters. The per-IP request rate limit on the
// endpoint (see Program.cs "login" policy) stays on top of this for bursts.
// Counters live in this server's memory; several API instances would need a shared cache instead.
public interface ILoginThrottle
{
    // How long the caller must wait, or null when a sign-in may be attempted.
    TimeSpan? RetryAfter(string email, string? ip);
    void RecordFailure(string email, string? ip);
    void RecordSuccess(string email, string? ip);
}

public class LoginThrottle(IMemoryCache cache) : ILoginThrottle
{
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(15);
    public const int PerAccountAndIp = 5;
    public const int PerAccount = 20;
    public const int PerIp = 50;

    private sealed class Counter
    {
        public int Count;
        public DateTime WindowEndsAt;
    }

    private static string Norm(string email) => email.Trim().ToLowerInvariant();
    private static string AccountIpKey(string email, string? ip) => $"login:acct-ip:{Norm(email)}|{ip ?? "?"}";
    private static string AccountKey(string email) => $"login:acct:{Norm(email)}";
    private static string IpKey(string? ip) => $"login:ip:{ip ?? "?"}";

    public TimeSpan? RetryAfter(string email, string? ip)
    {
        var now = DateTime.UtcNow;
        TimeSpan? wait = null;
        foreach (var (key, limit) in new[] { (AccountIpKey(email, ip), PerAccountAndIp), (AccountKey(email), PerAccount), (IpKey(ip), PerIp) })
        {
            if (cache.TryGetValue(key, out Counter? c) && c!.WindowEndsAt > now && c.Count >= limit)
            {
                var left = c.WindowEndsAt - now;
                wait = wait is null || left > wait ? left : wait;
            }
        }
        return wait;
    }

    public void RecordFailure(string email, string? ip)
    {
        Bump(AccountIpKey(email, ip));
        Bump(AccountKey(email));
        Bump(IpKey(ip));
    }

    public void RecordSuccess(string email, string? ip)
    {
        cache.Remove(AccountIpKey(email, ip));
        cache.Remove(AccountKey(email));
    }

    private void Bump(string key)
    {
        var now = DateTime.UtcNow;
        lock (cache)
        {
            if (!cache.TryGetValue(key, out Counter? c) || c!.WindowEndsAt <= now)
            {
                c = new Counter { WindowEndsAt = now.Add(Window) };
                cache.Set(key, c, c.WindowEndsAt);
            }
            c.Count++;
        }
    }
}
