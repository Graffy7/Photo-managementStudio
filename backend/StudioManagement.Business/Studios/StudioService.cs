using StudioManagement.Business.Audit;
using StudioManagement.Business.Auth;
using StudioManagement.Business.Common;
using StudioManagement.Business.Storage;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Studios;

public class StudioService(
    IStudioRepository studioRepository,
    IUserRepository userRepository,
    IRepository<SubscriptionPlan> subscriptionPlanRepository,
    IRepository<StudioSubscription> studioSubscriptionRepository,
    IPasswordHasher passwordHasher,
    IAuditService auditService,
    IFileStorage fileStorage,
    IUnitOfWork unitOfWork) : IStudioService
{
    private const string Module = "Studios";

    public async Task<StudioCreationResult> CreateAsync(CreateStudioRequestDto request, CancellationToken ct = default)
    {
        var emailTaken = await studioRepository.EmailExistsAsync(request.OwnerEmail, ct)
            || await userRepository.FindByEmailAsync(request.OwnerEmail, ct) is not null;
        if (emailTaken)
        {
            return StudioCreationResult.Fail(StudioCreationFailureReason.EmailAlreadyExists);
        }

        var plan = await subscriptionPlanRepository.GetByIdAsync(request.SubscriptionPlanId, ct);
        if (plan is null)
        {
            return StudioCreationResult.Fail(StudioCreationFailureReason.PlanNotFound);
        }

        var now = DateTime.UtcNow;
        var studio = new Studio
        {
            StudioName = request.StudioName,
            OwnerName = request.OwnerFullName,
            Email = request.OwnerEmail,
            PhoneNumber = request.PhoneNumber,
            Address = request.Address,
            IsActive = true,
            IsBlocked = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        var owner = new User
        {
            FullName = request.OwnerFullName,
            Email = request.OwnerEmail,
            PasswordHash = passwordHasher.Hash(request.OwnerPassword),
            UserType = UserTypes.StudioOwner,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
            Studio = studio
        };

        var subscription = new StudioSubscription
        {
            Studio = studio,
            SubscriptionPlan = plan,
            StartDate = now,
            EndDate = now.AddDays(plan.DurationInDays),
            Amount = plan.Price,
            Status = SubscriptionStatuses.Active,
            CreatedAt = now,
            UpdatedAt = now
        };

        await studioRepository.AddAsync(studio, ct);
        await userRepository.AddAsync(owner, ct);
        await studioSubscriptionRepository.AddAsync(subscription, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogAsync("Studio created", Module, studio.StudioId, ct);

        studio.Subscriptions = [subscription];
        return StudioCreationResult.Success(MapToDto(studio));
    }

    public async Task<PagedResult<StudioDto>> SearchAsync(string? search, bool? isActive, int page, int pageSize, CancellationToken ct = default)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var (items, totalCount) = await studioRepository.SearchAsync(search, isActive, page, pageSize, ct);
        return new PagedResult<StudioDto>
        {
            Items = await AttachOwnersAsync(items, ct),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }


    private async Task<List<StudioDto>> AttachOwnersAsync(List<Data.Entities.Studio> studios, CancellationToken ct)
    {
        var dtos = studios.Select(MapToDto).ToList();
        var owners = await userRepository.GetStudioOwnersAsync(studios.Select(s => s.StudioId).ToList(), ct);
        foreach (var dto in dtos)
        {
            ApplyOwner(dto, owners.FirstOrDefault(o => o.StudioId == dto.StudioId));
        }

        return dtos;
    }
    public async Task<StudioDto?> GetByIdAsync(int studioId, CancellationToken ct = default)
    {
        var studio = await studioRepository.GetByIdAsync(studioId, ct);
        if (studio is null)
        {
            return null;
        }

        var dto = MapToDto(studio);
        ApplyOwner(dto, await userRepository.GetStudioOwnerAsync(studioId, ct));
        return dto;
    }

    // The login account is a separate row from the studio, so the detail screen shows the email the
    // owner actually signs in with rather than the studio contact address (they can drift apart).
    private static void ApplyOwner(StudioDto dto, Data.Entities.User? owner)
    {
        if (owner is null)
        {
            return;
        }

        dto.OwnerUserId = owner.UserId;
        dto.LoginEmail = owner.Email;
        dto.OwnerIsActive = owner.IsActive;
        dto.OwnerLastLoginAt = owner.LastLoginAt;
    }

    public async Task<StudioUpdateResult> UpdateAsync(int studioId, UpdateStudioRequestDto request, CancellationToken ct = default)
    {
        var studio = await studioRepository.GetByIdAsync(studioId, ct);
        if (studio is null)
        {
            return StudioUpdateResult.Fail(StudioUpdateFailureReason.NotFound);
        }

        studio.StudioName = request.StudioName;
        studio.OwnerName = request.OwnerName;
        var owner = await userRepository.GetStudioOwnerAsync(studioId, ct);
        if (!string.IsNullOrWhiteSpace(request.Email) && !string.Equals(request.Email, studio.Email, StringComparison.OrdinalIgnoreCase))
        {
            // Changing the email here must move the LOGIN too, or the super admin would think they had
            // changed how the owner signs in when they had not.
            if (await userRepository.FindByEmailAsync(request.Email, ct) is { } clash && clash.UserId != owner?.UserId)
            {
                return StudioUpdateResult.Fail(StudioUpdateFailureReason.EmailAlreadyExists);
            }

            studio.Email = request.Email;
            if (owner is not null)
            {
                owner.Email = request.Email;
                owner.UpdatedAt = DateTime.UtcNow;
                userRepository.Update(owner);
            }
        }
        studio.PhoneNumber = request.PhoneNumber;
        studio.Address = request.Address;
        studio.City = request.City;
        studio.State = request.State;
        studio.Pincode = request.Pincode;
        studio.GstNumber = request.GstNumber;
        studio.Website = request.Website;
        studio.UpdatedAt = DateTime.UtcNow;

        studioRepository.Update(studio);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Studio details updated", Module, studio.StudioId, ct);

        var dto = MapToDto(studio);
        ApplyOwner(dto, owner);
        return StudioUpdateResult.Success(dto);
    }


    public async Task<PasswordResetResult> ResetOwnerPasswordAsync(int studioId, string newPassword, CancellationToken ct = default)
    {
        var studio = await studioRepository.GetByIdAsync(studioId, ct);
        if (studio is null)
        {
            return PasswordResetResult.Fail(PasswordResetFailureReason.StudioNotFound);
        }

        var owner = await userRepository.GetStudioOwnerAsync(studioId, ct);
        if (owner is null)
        {
            return PasswordResetResult.Fail(PasswordResetFailureReason.OwnerNotFound);
        }

        owner.PasswordHash = passwordHasher.Hash(newPassword);
        owner.UpdatedAt = DateTime.UtcNow;
        userRepository.Update(owner);
        await unitOfWork.SaveChangesAsync(ct);

        // The password itself is never written to the audit trail — only that it was changed.
        await auditService.LogAsync($"Studio owner password reset by super admin ({owner.Email})", Module, studioId, ct);
        return PasswordResetResult.Success(owner.Email);
    }
    public async Task<StudioDto?> UploadLogoAsync(int studioId, Stream content, string fileName, CancellationToken ct = default)
    {
        var studio = await studioRepository.GetByIdAsync(studioId, ct);
        if (studio is null)
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(studio.LogoUrl))
        {
            fileStorage.Delete(studio.LogoUrl);
        }

        studio.LogoUrl = await fileStorage.SaveAsync(content, fileName, $"logos/{studioId}", ct);
        studio.UpdatedAt = DateTime.UtcNow;

        studioRepository.Update(studio);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Studio logo updated", Module, studio.StudioId, ct);
        return MapToDto(studio);
    }

    public async Task<StudioDto?> RemoveLogoAsync(int studioId, CancellationToken ct = default)
    {
        var studio = await studioRepository.GetByIdAsync(studioId, ct);
        if (studio is null)
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(studio.LogoUrl))
        {
            fileStorage.Delete(studio.LogoUrl);
        }

        studio.LogoUrl = null;
        studio.UpdatedAt = DateTime.UtcNow;

        studioRepository.Update(studio);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Studio logo removed", Module, studio.StudioId, ct);
        return MapToDto(studio);
    }

    public async Task<StudioDto?> SetActiveAsync(int studioId, bool isActive, CancellationToken ct = default)
    {
        var studio = await studioRepository.GetByIdAsync(studioId, ct);
        if (studio is null)
        {
            return null;
        }

        studio.IsActive = isActive;
        studio.UpdatedAt = DateTime.UtcNow;

        studioRepository.Update(studio);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync(isActive ? "Studio activated" : "Studio deactivated", Module, studio.StudioId, ct);
        return MapToDto(studio);
    }

    public async Task<StudioDto?> SetBlockedAsync(int studioId, bool isBlocked, CancellationToken ct = default)
    {
        var studio = await studioRepository.GetByIdAsync(studioId, ct);
        if (studio is null)
        {
            return null;
        }

        studio.IsBlocked = isBlocked;
        studio.UpdatedAt = DateTime.UtcNow;

        studioRepository.Update(studio);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync(isBlocked ? "Studio blocked" : "Studio unblocked", Module, studio.StudioId, ct);
        return MapToDto(studio);
    }

    private static StudioDto MapToDto(Studio studio)
    {
        var subscription = studio.Subscriptions?.OrderByDescending(s => s.StartDate).FirstOrDefault();

        return new StudioDto
        {
            StudioId = studio.StudioId,
            StudioName = studio.StudioName,
            OwnerName = studio.OwnerName,
            Email = studio.Email,
            PhoneNumber = studio.PhoneNumber,
            Address = studio.Address,
            City = studio.City,
            State = studio.State,
            Pincode = studio.Pincode,
            GstNumber = studio.GstNumber,
            Website = studio.Website,
            LogoUrl = studio.LogoUrl,
            IsActive = studio.IsActive,
            IsBlocked = studio.IsBlocked,
            CreatedAt = studio.CreatedAt,
            SubscriptionPlanId = subscription?.SubscriptionPlanId,
            PlanName = subscription?.SubscriptionPlan?.PlanName,
            SubscriptionStatus = subscription?.Status,
            SubscriptionStartDate = subscription?.StartDate,
            SubscriptionEndDate = subscription?.EndDate
        };
    }
}
