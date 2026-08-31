using StudioManagement.Data.Entities;

namespace StudioManagement.Business.Auth;

public enum RefreshTokenFailureReason
{
    NotFound,
    Expired,
    Revoked
}

public class RefreshTokenRotationResult
{
    public bool Succeeded { get; private init; }
    public RefreshTokenFailureReason? FailureReason { get; private init; }
    public User? User { get; private init; }
    public string? NewRawToken { get; private init; }
    public DateTime? NewExpiresAtUtc { get; private init; }

    public static RefreshTokenRotationResult Success(User user, string newRawToken, DateTime newExpiresAtUtc) => new()
    {
        Succeeded = true,
        User = user,
        NewRawToken = newRawToken,
        NewExpiresAtUtc = newExpiresAtUtc
    };

    public static RefreshTokenRotationResult Fail(RefreshTokenFailureReason reason) => new()
    {
        Succeeded = false,
        FailureReason = reason
    };
}
