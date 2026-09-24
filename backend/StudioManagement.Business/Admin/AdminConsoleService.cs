using StudioManagement.Business.Audit;
using StudioManagement.Business.Common;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Admin;

public interface IAdminConsoleService
{
    Task<AdminOverviewDto> GetOverviewAsync(DateTime? from, DateTime? to, CancellationToken ct = default);
    Task<PagedResult<AdminStudioRowDto>> GetStudiosAsync(string? search, string? status, string? plan, string? sort, int page, int pageSize, CancellationToken ct = default);
    Task<AdminStudioDetailDto?> GetStudioAsync(int studioId, CancellationToken ct = default);
    Task<AdminStudioUsageDto?> GetUsageAsync(int studioId, DateTime? from, DateTime? to, bool refreshStorage, CancellationToken ct = default);
    Task<AdminSubscriptionDto?> GetSubscriptionAsync(int studioId, CancellationToken ct = default);
    Task<PagedResult<AdminActivityDto>> GetActivityAsync(int? studioId, DateTime? from, DateTime? to, string? module, string? search, int page, int pageSize, CancellationToken ct = default);
    Task<List<string>> GetActivityModulesAsync(int? studioId, CancellationToken ct = default);

    Task<AdminResult> StartTrialAsync(int studioId, int days, CancellationToken ct = default);
    Task<AdminResult> ExtendTrialAsync(int studioId, int days, CancellationToken ct = default);
    Task<AdminResult> EndTrialAsync(int studioId, CancellationToken ct = default);
    Task<AdminResult> RecordPaymentAsync(int studioId, ManualPaymentRequestDto request, CancellationToken ct = default);
}

public enum AdminFailure
{
    NotFound,
    Conflict,
    Invalid
}

public class AdminResult
{
    public bool Succeeded { get; private init; }
    public AdminFailure? Failure { get; private init; }
    public string? Message { get; private init; }

    public static AdminResult Ok() => new() { Succeeded = true };
    public static AdminResult Fail(AdminFailure failure, string? message = null) => new() { Failure = failure, Message = message };
}

public class AdminConsoleService(
    IAdminConsoleRepository repository,
    IStudioUsageRepository usageRepository,
    IStorageUsageService storageService,
    IUserRepository userRepository,
    IStudioRepository studioRepository,
    IStudioSubscriptionRepository subscriptionRepository,
    ISubscriptionPaymentRepository paymentRepository,
    IRepository<SubscriptionPlan> planRepository,
    IAuditService auditService,
    IUnitOfWork unitOfWork) : IAdminConsoleService
{
    private const string Module = "Subscriptions";
    private const double DaysPerMonth = 30.4375;

    // ---- Shared snapshot -----------------------------------------------------------------------

    private sealed record StudioState(
        Studio Studio, User? Owner, StudioSubscription? Current, string Status, int DaysRemaining,
        List<SubscriptionPayment> Payments, int MonthsSubscribed, decimal TotalPaid);

    private async Task<List<StudioState>> LoadStatesAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var studios = await repository.GetStudiosAsync(ct);
        var owners = await userRepository.GetStudioOwnersAsync(studios.Select(s => s.StudioId).ToList(), ct);
        var subscriptions = await repository.GetSubscriptionsAsync(null, ct);
        var payments = await repository.GetPaymentsAsync(null, ct);
        var plans = await planRepository.GetAllAsync(ct);

        return studios.Select(studio =>
        {
            var subs = subscriptions.Where(s => s.StudioId == studio.StudioId).ToList();
            var current = CurrentOf(subs);
            var studioPayments = payments.Where(p => p.StudioSubscription.StudioId == studio.StudioId).ToList();
            var months = studioPayments.Sum(p => MonthsOf(p, plans));
            return new StudioState(
                studio,
                owners.FirstOrDefault(o => o.StudioId == studio.StudioId),
                current,
                StatusOf(studio, current, now),
                DaysRemaining(current, now),
                studioPayments,
                months,
                studioPayments.Sum(p => p.Amount));
        }).ToList();
    }

    private static StudioSubscription? CurrentOf(IEnumerable<StudioSubscription> subs) =>
        subs.OrderByDescending(s => s.StartDate).ThenByDescending(s => s.StudioSubscriptionId).FirstOrDefault();

    internal static string StatusOf(Studio studio, StudioSubscription? current, DateTime now)
    {
        if (studio.IsBlocked) return AdminStudioStatuses.Blocked;
        if (!studio.IsActive) return AdminStudioStatuses.Inactive;
        if (current is null) return AdminStudioStatuses.NoPlan;
        if (current.Status == SubscriptionStatuses.Cancelled || current.EndDate < now) return AdminStudioStatuses.Expired;
        return current.IsTrial ? AdminStudioStatuses.Trial : AdminStudioStatuses.Active;
    }

    private static int DaysRemaining(StudioSubscription? current, DateTime now) =>
        current is null || current.Status == SubscriptionStatuses.Cancelled || current.EndDate <= now
            ? 0
            : (int)Math.Ceiling((current.EndDate - now).TotalDays);

    // Months a payment bought: from its recorded period, or (older payments) from the plan whose
    // price it matches.
    private static int MonthsOf(SubscriptionPayment p, List<SubscriptionPlan> plans)
    {
        if (p.PeriodStart is { } start && p.PeriodEnd is { } end && end > start)
        {
            return Math.Max(1, (int)Math.Round((end - start).TotalDays / DaysPerMonth));
        }

        // No period and no matching plan price: money only (an adjustment), no months bought.
        var plan = plans.FirstOrDefault(pl => pl.Price == p.Amount);
        return plan is null || plan.DurationInDays <= 0 ? 0 : Math.Max(1, (int)Math.Round(plan.DurationInDays / DaysPerMonth));
    }

    private static AdminStudioRowDto ToRow(StudioState s, IReadOnlyDictionary<int, StudioStorageDto> storage, IReadOnlyDictionary<int, DateTime> lastSeen)
    {
        storage.TryGetValue(s.Studio.StudioId, out var st);
        lastSeen.TryGetValue(s.Studio.StudioId, out var seen);
        var lastLogin = s.Owner?.LastLoginAt;
        DateTime? lastActive = seen == default ? lastLogin : lastLogin is null || seen > lastLogin ? seen : lastLogin;

        return new AdminStudioRowDto
        {
            StudioId = s.Studio.StudioId,
            StudioName = s.Studio.StudioName,
            OwnerName = s.Owner?.FullName ?? s.Studio.OwnerName,
            OwnerEmail = s.Owner?.Email ?? s.Studio.Email,
            PhoneNumber = s.Studio.PhoneNumber,
            Status = s.Status,
            IsActive = s.Studio.IsActive,
            IsBlocked = s.Studio.IsBlocked,
            PlanName = s.Current is null ? null : s.Current.IsTrial ? "Trial" : s.Current.SubscriptionPlan.PlanName,
            IsTrial = s.Current?.IsTrial ?? false,
            StartDate = s.Current?.StartDate,
            EndDate = s.Current?.EndDate,
            DaysRemaining = s.DaysRemaining,
            MonthsSubscribed = s.MonthsSubscribed,
            TotalPaid = s.TotalPaid,
            PaymentCount = s.Payments.Count,
            AppStorageBytes = st?.AppBytes ?? 0,
            OriginalStorageBytes = st?.OriginalBytes ?? 0,
            LastActiveAt = lastActive,
            CreatedAt = s.Studio.CreatedAt
        };
    }

    // ---- Dashboard -----------------------------------------------------------------------------

    public async Task<AdminOverviewDto> GetOverviewAsync(DateTime? from, DateTime? to, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var end = (to ?? now).Date.AddDays(1);
        var start = (from ?? new DateTime(now.Year, now.Month, 1).AddMonths(-11)).Date;
        if (start >= end) start = end.AddMonths(-1);
        if ((end - start).TotalDays > 366 * 3) start = end.AddYears(-3);

        var states = await LoadStatesAsync(ct);
        var (storage, _) = await storageService.GetAllAsync(false, ct);
        var payments = states.SelectMany(s => s.Payments).ToList();

        var months = new List<DateTime>();
        for (var m = new DateTime(start.Year, start.Month, 1); m < end; m = m.AddMonths(1)) months.Add(m);

        var names = states.ToDictionary(s => s.Studio.StudioId, s => s.Studio.StudioName);
        var storageList = storage.Values
            .Select(v => new StudioStorageDto
            {
                StudioId = v.StudioId,
                StudioName = names.GetValueOrDefault(v.StudioId, $"Studio {v.StudioId}"),
                OriginalBytes = v.OriginalBytes,
                PreviewBytes = v.PreviewBytes,
                ThumbnailBytes = v.ThumbnailBytes,
                PhotoCount = v.PhotoCount,
                MissingOriginals = v.MissingOriginals
            })
            .OrderByDescending(v => v.AppBytes).Take(8).ToList();

        return new AdminOverviewDto
        {
            TotalStudios = states.Count,
            ActiveSubscriptions = states.Count(s => s.Status == AdminStudioStatuses.Active),
            ActiveTrials = states.Count(s => s.Status == AdminStudioStatuses.Trial),
            Expired = states.Count(s => s.Status == AdminStudioStatuses.Expired),
            Blocked = states.Count(s => s.Status == AdminStudioStatuses.Blocked),
            ExpiringIn7Days = states.Count(s => s.Status is AdminStudioStatuses.Active or AdminStudioStatuses.Trial && s.DaysRemaining <= 7),
            TotalRevenue = payments.Sum(p => p.Amount),
            RangeRevenue = payments.Where(p => p.PaymentDate >= start && p.PaymentDate < end).Sum(p => p.Amount),
            AppStorageBytes = storage.Values.Sum(v => v.AppBytes),
            OriginalStorageBytes = storage.Values.Sum(v => v.OriginalBytes),
            RangeStart = start,
            RangeEnd = end.AddDays(-1),
            RevenueByMonth = months.Select(m => new MonthValueDto
            {
                Month = m.ToString("yyyy-MM"),
                Value = payments.Where(p => p.PaymentDate >= m && p.PaymentDate < m.AddMonths(1)).Sum(p => p.Amount)
            }).ToList(),
            NewStudiosByMonth = months.Select(m => new MonthValueDto
            {
                Month = m.ToString("yyyy-MM"),
                Value = states.Count(s => s.Studio.CreatedAt >= m && s.Studio.CreatedAt < m.AddMonths(1))
            }).ToList(),
            StatusBreakdown = AdminStudioStatuses.All.ToDictionary(k => k, k => states.Count(s => s.Status == k)),
            StorageByStudio = storageList
        };
    }

    // ---- Studio table --------------------------------------------------------------------------

    public async Task<PagedResult<AdminStudioRowDto>> GetStudiosAsync(string? search, string? status, string? plan, string? sort, int page, int pageSize, CancellationToken ct = default)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var states = await LoadStatesAsync(ct);
        var (storage, _) = await storageService.GetAllAsync(false, ct);
        var lastSeen = await usageRepository.GetLastSeenAsync(ct);
        IEnumerable<AdminStudioRowDto> rows = states.Select(s => ToRow(s, storage, lastSeen));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            rows = rows.Where(r =>
                r.StudioName.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                (r.OwnerName?.Contains(term, StringComparison.OrdinalIgnoreCase) ?? false) ||
                (r.OwnerEmail?.Contains(term, StringComparison.OrdinalIgnoreCase) ?? false) ||
                (r.PhoneNumber?.Contains(term, StringComparison.OrdinalIgnoreCase) ?? false));
        }
        if (!string.IsNullOrWhiteSpace(status))
        {
            rows = rows.Where(r => string.Equals(r.Status, status, StringComparison.OrdinalIgnoreCase));
        }
        if (!string.IsNullOrWhiteSpace(plan))
        {
            rows = rows.Where(r => string.Equals(r.PlanName, plan, StringComparison.OrdinalIgnoreCase));
        }

        rows = (sort ?? "name") switch
        {
            "lastActive" => rows.OrderByDescending(r => r.LastActiveAt ?? DateTime.MinValue),
            "daysRemaining" => rows.OrderBy(r => r.Status is AdminStudioStatuses.Active or AdminStudioStatuses.Trial ? r.DaysRemaining : int.MaxValue),
            "totalPaid" => rows.OrderByDescending(r => r.TotalPaid),
            "storage" => rows.OrderByDescending(r => r.AppStorageBytes),
            "newest" => rows.OrderByDescending(r => r.CreatedAt),
            _ => rows.OrderBy(r => r.StudioName, StringComparer.OrdinalIgnoreCase)
        };

        var list = rows.ToList();
        return new PagedResult<AdminStudioRowDto>
        {
            Items = list.Skip((page - 1) * pageSize).Take(pageSize).ToList(),
            TotalCount = list.Count,
            Page = page,
            PageSize = pageSize
        };
    }

    // ---- One studio ----------------------------------------------------------------------------

    public async Task<AdminStudioDetailDto?> GetStudioAsync(int studioId, CancellationToken ct = default)
    {
        var state = (await LoadStatesAsync(ct)).FirstOrDefault(s => s.Studio.StudioId == studioId);
        if (state is null)
        {
            return null;
        }

        var (storage, _) = await storageService.GetAllAsync(false, ct);
        var lastSeen = await usageRepository.GetLastSeenAsync(ct);
        var today = DateTime.UtcNow.Date;
        var usage = await usageRepository.GetForStudioAsync(studioId, today.AddDays(-29), today, ct);

        return new AdminStudioDetailDto
        {
            Studio = ToRow(state, storage, lastSeen),
            Address = state.Studio.Address,
            City = state.Studio.City,
            LoginEmail = state.Owner?.Email,
            LastLoginAt = state.Owner?.LastLoginAt,
            SubscriptionPlanId = state.Current?.SubscriptionPlanId,
            PlanPrice = state.Current?.SubscriptionPlan.Price,
            PlanDurationDays = state.Current?.SubscriptionPlan.DurationInDays,
            Usage = new UsagePeriodDto
            {
                TodayMinutes = usage.Where(u => u.UsageDate == today).Sum(u => u.ActiveMinutes),
                Last7DaysMinutes = usage.Where(u => u.UsageDate > today.AddDays(-7)).Sum(u => u.ActiveMinutes),
                Last30DaysMinutes = usage.Sum(u => u.ActiveMinutes),
                ActiveDaysLast30 = usage.Count(u => u.ActiveMinutes > 0 || u.RequestCount > 0)
            }
        };
    }

    public async Task<AdminStudioUsageDto?> GetUsageAsync(int studioId, DateTime? from, DateTime? to, bool refreshStorage, CancellationToken ct = default)
    {
        var studio = await studioRepository.GetByIdAsync(studioId, ct);
        if (studio is null)
        {
            return null;
        }

        var end = (to ?? DateTime.UtcNow).Date;
        var start = (from ?? end.AddDays(-29)).Date;
        if (start > end) (start, end) = (end, start);
        if ((end - start).TotalDays > 366) start = end.AddDays(-366);

        var (storage, measuredAt) = await storageService.GetAllAsync(refreshStorage, ct);
        storage.TryGetValue(studioId, out var st);
        var counts = await repository.GetCountsAsync(studioId, ct);
        var daily = await usageRepository.GetForStudioAsync(studioId, start, end, ct);
        var lastSeen = (await usageRepository.GetLastSeenAsync(ct)).GetValueOrDefault(studioId);

        // Every day in the range, including the quiet ones, so the chart reads true.
        var byDay = daily.ToDictionary(d => d.UsageDate.Date);
        var days = new List<DailyUsageDto>();
        for (var d = start; d <= end; d = d.AddDays(1))
        {
            byDay.TryGetValue(d, out var u);
            days.Add(new DailyUsageDto { Date = d, ActiveMinutes = u?.ActiveMinutes ?? 0, Requests = u?.RequestCount ?? 0 });
        }

        return new AdminStudioUsageDto
        {
            Storage = new StudioStorageDto
            {
                StudioId = studioId,
                StudioName = studio.StudioName,
                OriginalBytes = st?.OriginalBytes ?? 0,
                PreviewBytes = st?.PreviewBytes ?? 0,
                ThumbnailBytes = st?.ThumbnailBytes ?? 0,
                PhotoCount = st?.PhotoCount ?? 0,
                MissingOriginals = st?.MissingOriginals ?? 0
            },
            Records = new Dictionary<string, int>
            {
                ["Customers"] = counts.Customers,
                ["Events"] = counts.Events,
                ["Leads"] = counts.Leads,
                ["Quotations"] = counts.Quotations,
                ["Payments"] = counts.Payments,
                ["Workers"] = counts.Workers,
                ["Expenses"] = counts.Expenses
            },
            FeatureUsage =
            [
                new() { Name = "Photo galleries", Count = counts.Galleries },
                new() { Name = "Photos imported", Count = counts.Photos },
                new() { Name = "Customer selections submitted", Count = counts.SelectionsSubmitted },
                new() { Name = "Photos selected by customers", Count = counts.SelectedPhotos },
                new() { Name = "Delivery items delivered", Count = counts.DeliveredItems },
                new() { Name = "WhatsApp reminders sent", Count = counts.WhatsAppSent }
            ],
            Daily = days,
            LastActivityAt = lastSeen == default ? null : lastSeen,
            StorageMeasuredAt = measuredAt
        };
    }

    public async Task<AdminSubscriptionDto?> GetSubscriptionAsync(int studioId, CancellationToken ct = default)
    {
        var state = (await LoadStatesAsync(ct)).FirstOrDefault(s => s.Studio.StudioId == studioId);
        if (state is null)
        {
            return null;
        }

        var plans = await planRepository.GetAllAsync(ct);
        return new AdminSubscriptionDto
        {
            Status = state.Status,
            IsTrial = state.Current?.IsTrial ?? false,
            SubscriptionPlanId = state.Current?.SubscriptionPlanId,
            PlanName = state.Current is null ? null : state.Current.IsTrial ? "Trial" : state.Current.SubscriptionPlan.PlanName,
            StartDate = state.Current?.StartDate,
            EndDate = state.Current?.EndDate,
            DaysRemaining = state.DaysRemaining,
            MonthsPurchased = state.MonthsSubscribed,
            PaymentCount = state.Payments.Count,
            TotalPaid = state.TotalPaid,
            Payments = state.Payments.OrderByDescending(p => p.PaymentDate).Select(p => new AdminPaymentDto
            {
                PaymentId = p.SubscriptionPaymentId,
                Amount = p.Amount,
                PaymentDate = p.PaymentDate,
                PaymentMethod = p.PaymentMethod,
                ReferenceNumber = p.ReferenceNumber,
                Notes = p.Notes,
                PlanName = p.StudioSubscription.SubscriptionPlan.PlanName,
                PeriodStart = p.PeriodStart,
                PeriodEnd = p.PeriodEnd,
                Months = MonthsOf(p, plans)
            }).ToList()
        };
    }

    // ---- Activity ------------------------------------------------------------------------------

    public async Task<PagedResult<AdminActivityDto>> GetActivityAsync(int? studioId, DateTime? from, DateTime? to, string? module, string? search, int page, int pageSize, CancellationToken ct = default)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 25 : pageSize;

        var (items, total) = await repository.SearchActivityAsync(
            new ActivityQuery(studioId, from?.Date, to?.Date.AddDays(1), module, search, page, pageSize), ct);

        return new PagedResult<AdminActivityDto>
        {
            Items = items.Select(a => new AdminActivityDto
            {
                Id = a.AuditLogId,
                CreatedAt = a.CreatedAt,
                StudioId = a.StudioId,
                StudioName = a.StudioName,
                Module = a.Module,
                Action = a.Action,
                UserName = a.UserName,
                UserType = a.UserType,
                IpAddress = a.IpAddress,
                Device = a.Device
            }).ToList(),
            TotalCount = total,
            Page = page,
            PageSize = pageSize
        };
    }

    public Task<List<string>> GetActivityModulesAsync(int? studioId, CancellationToken ct = default) =>
        repository.GetActivityModulesAsync(studioId, ct);

    // ---- Trials --------------------------------------------------------------------------------

    public async Task<AdminResult> StartTrialAsync(int studioId, int days, CancellationToken ct = default)
    {
        var studio = await studioRepository.GetByIdAsync(studioId, ct);
        if (studio is null)
        {
            return AdminResult.Fail(AdminFailure.NotFound);
        }

        var now = DateTime.UtcNow;
        var current = await subscriptionRepository.GetCurrentAsync(studioId, ct);
        if (current is not null && current.Status != SubscriptionStatuses.Cancelled && current.EndDate > now)
        {
            if (current.IsTrial)
            {
                return AdminResult.Fail(AdminFailure.Conflict, "A trial is already running. Extend or end it instead.");
            }

            var paid = await paymentRepository.GetByStudioSubscriptionIdAsync(current.StudioSubscriptionId, ct);
            if (paid.Count > 0)
            {
                return AdminResult.Fail(AdminFailure.Conflict, "This studio has a paid subscription running. A trial can start after it ends.");
            }

            // An unpaid plan (e.g. assigned when the studio was created) makes way for the trial.
            current.Status = SubscriptionStatuses.Cancelled;
            current.EndDate = now;
            current.UpdatedAt = now;
            subscriptionRepository.Update(current);
        }
        else if (current is not null && current.Status == SubscriptionStatuses.Active)
        {
            current.Status = SubscriptionStatuses.Expired;
            current.UpdatedAt = now;
            subscriptionRepository.Update(current);
        }

        var planId = current?.SubscriptionPlanId ?? (await planRepository.GetAllAsync(ct)).OrderBy(p => p.Price).First().SubscriptionPlanId;
        await subscriptionRepository.AddAsync(new StudioSubscription
        {
            StudioId = studioId,
            SubscriptionPlanId = planId,
            StartDate = now,
            EndDate = now.AddDays(days),
            Amount = 0,
            Status = SubscriptionStatuses.Active,
            IsTrial = true,
            CreatedAt = now,
            UpdatedAt = now
        }, ct);

        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync($"Trial started ({days} days)", Module, studioId, ct);
        return AdminResult.Ok();
    }

    public async Task<AdminResult> ExtendTrialAsync(int studioId, int days, CancellationToken ct = default)
    {
        var current = await subscriptionRepository.GetCurrentAsync(studioId, ct);
        if (current is null || !current.IsTrial)
        {
            return await studioRepository.GetByIdAsync(studioId, ct) is null
                ? AdminResult.Fail(AdminFailure.NotFound)
                : AdminResult.Fail(AdminFailure.Conflict, "This studio isn't on a trial. Start one first.");
        }

        // An ended trial restarts from today; a running one gets the days added on.
        var now = DateTime.UtcNow;
        var from = current.EndDate > now && current.Status != SubscriptionStatuses.Cancelled ? current.EndDate : now;
        current.EndDate = from.AddDays(days);
        current.Status = SubscriptionStatuses.Active;
        current.UpdatedAt = now;
        subscriptionRepository.Update(current);

        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync($"Trial extended by {days} days", Module, studioId, ct);
        return AdminResult.Ok();
    }

    public async Task<AdminResult> EndTrialAsync(int studioId, CancellationToken ct = default)
    {
        var current = await subscriptionRepository.GetCurrentAsync(studioId, ct);
        var now = DateTime.UtcNow;
        if (current is null || !current.IsTrial || current.EndDate <= now || current.Status != SubscriptionStatuses.Active)
        {
            return await studioRepository.GetByIdAsync(studioId, ct) is null
                ? AdminResult.Fail(AdminFailure.NotFound)
                : AdminResult.Fail(AdminFailure.Conflict, "There is no running trial to end.");
        }

        current.EndDate = now;
        current.Status = SubscriptionStatuses.Expired;
        current.UpdatedAt = now;
        subscriptionRepository.Update(current);

        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Trial ended", Module, studioId, ct);
        return AdminResult.Ok();
    }

    // ---- Payments ------------------------------------------------------------------------------

    public async Task<AdminResult> RecordPaymentAsync(int studioId, ManualPaymentRequestDto request, CancellationToken ct = default)
    {
        if (await studioRepository.GetByIdAsync(studioId, ct) is null)
        {
            return AdminResult.Fail(AdminFailure.NotFound);
        }

        var plans = await planRepository.GetAllAsync(ct);
        var current = await subscriptionRepository.GetCurrentAsync(studioId, ct);
        var planId = request.SubscriptionPlanId ?? current?.SubscriptionPlanId;
        var plan = plans.FirstOrDefault(p => p.SubscriptionPlanId == planId) ?? plans.OrderBy(p => p.Price).FirstOrDefault();
        if (plan is null)
        {
            return AdminResult.Fail(AdminFailure.Invalid, "No subscription plan is set up.");
        }

        var now = DateTime.UtcNow;
        var paymentDate = request.PaymentDate ?? now;
        StudioSubscription target;
        DateTime? periodStart = null, periodEnd = null;

        if (request.Months > 0)
        {
            var running = current is not null && current.Status != SubscriptionStatuses.Cancelled && current.EndDate > now;
            if (current is null || current.IsTrial || current.Status == SubscriptionStatuses.Cancelled)
            {
                // No subscription yet, or converting a trial: a new paid subscription from today,
                // and a running trial ends now.
                if (current is not null && current.IsTrial && running)
                {
                    current.EndDate = now;
                    current.Status = SubscriptionStatuses.Expired;
                    current.UpdatedAt = now;
                    subscriptionRepository.Update(current);
                }

                target = new StudioSubscription
                {
                    StudioId = studioId,
                    SubscriptionPlanId = plan.SubscriptionPlanId,
                    StartDate = now,
                    EndDate = now.AddMonths(request.Months),
                    Amount = request.Amount,
                    Status = SubscriptionStatuses.Active,
                    IsTrial = false,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                await subscriptionRepository.AddAsync(target, ct);
                periodStart = target.StartDate;
                periodEnd = target.EndDate;
            }
            else
            {
                // Paid subscription: the new months follow on from its end (or from today if it lapsed).
                target = current;
                periodStart = running ? current.EndDate : now;
                periodEnd = periodStart.Value.AddMonths(request.Months);
                if (!running) current.StartDate = now;
                current.EndDate = periodEnd.Value;
                current.SubscriptionPlanId = plan.SubscriptionPlanId;
                current.Amount = request.Amount;
                current.Status = SubscriptionStatuses.Active;
                current.UpdatedAt = now;
                subscriptionRepository.Update(current);
            }
        }
        else
        {
            if (current is null)
            {
                return AdminResult.Fail(AdminFailure.Invalid, "This studio has no subscription to record a payment against. Enter the months it pays for.");
            }
            target = current;
        }

        var payment = new SubscriptionPayment
        {
            StudioSubscription = target,
            Amount = request.Amount,
            PaymentDate = paymentDate,
            PaymentMethod = request.PaymentMethod,
            ReferenceNumber = string.IsNullOrWhiteSpace(request.ReferenceNumber) ? null : request.ReferenceNumber.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            PeriodStart = periodStart,
            PeriodEnd = periodEnd,
            CreatedAt = now
        };
        await paymentRepository.AddAsync(payment, ct);

        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync(
            request.Months > 0 ? $"Payment ₹{request.Amount:0.##} recorded, {request.Months} month(s) added" : $"Payment ₹{request.Amount:0.##} recorded",
            Module, studioId, ct);
        return AdminResult.Ok();
    }
}
