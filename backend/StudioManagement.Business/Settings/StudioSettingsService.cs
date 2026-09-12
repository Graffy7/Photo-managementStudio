using System.Globalization;
using StudioManagement.Data.Common;
using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.Settings;

public class StudioSettingsService(IStudioSettingRepository studioSettingRepository) : IStudioSettingsService
{
    private const string BusinessQuotationValidityDays = "Business.QuotationValidityDays";
    private const string BusinessCurrency = "Business.Currency";
    private const string BusinessTaxPercentage = "Business.TaxPercentage";
    private const string BusinessPaymentTerms = "Business.PaymentTerms";
    private const string BusinessAdvancePaymentPercentage = "Business.AdvancePaymentPercentage";
    private const string BusinessDateFormat = "Business.DateFormat";
    private const string BusinessTimeFormat = "Business.TimeFormat";

    private const string NotificationEventReminder = "Notification.EventReminder";
    private const string NotificationPaymentReminder = "Notification.PaymentReminder";
    private const string NotificationWorkerEventNotification = "Notification.WorkerEventNotification";
    private const string NotificationQuotationNotification = "Notification.QuotationNotification";
    private const string NotificationWhatsApp = "Notification.WhatsAppNotification";

    private const string QuotationPrefix = "Quotation.Prefix";
    private const string QuotationStartingNumber = "Quotation.StartingNumber";
    private const string QuotationDefaultTerms = "Quotation.DefaultTerms";
    private const string QuotationDefaultNotes = "Quotation.DefaultNotes";
    private const string QuotationShowGst = "Quotation.ShowGst";
    private const string QuotationShowAddress = "Quotation.ShowAddress";
    private const string QuotationShowContact = "Quotation.ShowContact";
    private const string QuotationShowLogo = "Quotation.ShowLogo";

    public async Task<BusinessSettingsDto> GetBusinessSettingsAsync(int studioId, CancellationToken ct = default)
    {
        var values = await LoadAsync(studioId, ct);
        return new BusinessSettingsDto
        {
            QuotationValidityDays = GetInt(values, BusinessQuotationValidityDays, 15),
            Currency = GetString(values, BusinessCurrency, "INR"),
            TaxPercentage = GetDecimal(values, BusinessTaxPercentage, 0m),
            PaymentTerms = GetString(values, BusinessPaymentTerms, ""),
            AdvancePaymentPercentage = GetDecimal(values, BusinessAdvancePaymentPercentage, 0m),
            DateFormat = GetString(values, BusinessDateFormat, "DD/MM/YYYY"),
            TimeFormat = GetString(values, BusinessTimeFormat, "24h")
        };
    }

    public async Task<BusinessSettingsDto> UpdateBusinessSettingsAsync(int studioId, BusinessSettingsDto request, CancellationToken ct = default)
    {
        await studioSettingRepository.UpsertManyAsync(studioId, new Dictionary<string, string?>
        {
            [BusinessQuotationValidityDays] = request.QuotationValidityDays.ToString(CultureInfo.InvariantCulture),
            [BusinessCurrency] = request.Currency,
            [BusinessTaxPercentage] = request.TaxPercentage.ToString(CultureInfo.InvariantCulture),
            [BusinessPaymentTerms] = request.PaymentTerms,
            [BusinessAdvancePaymentPercentage] = request.AdvancePaymentPercentage.ToString(CultureInfo.InvariantCulture),
            [BusinessDateFormat] = request.DateFormat,
            [BusinessTimeFormat] = request.TimeFormat
        }, ct);
        return request;
    }

    public async Task<NotificationSettingsDto> GetNotificationSettingsAsync(int studioId, CancellationToken ct = default)
    {
        var values = await LoadAsync(studioId, ct);
        return new NotificationSettingsDto
        {
            EventReminder = GetBool(values, NotificationEventReminder, true),
            PaymentReminder = GetBool(values, NotificationPaymentReminder, true),
            WorkerEventNotification = GetBool(values, NotificationWorkerEventNotification, true),
            QuotationNotification = GetBool(values, NotificationQuotationNotification, true),
            WhatsAppNotification = GetBool(values, NotificationWhatsApp, false)
        };
    }

    public async Task<NotificationSettingsDto> UpdateNotificationSettingsAsync(int studioId, NotificationSettingsDto request, CancellationToken ct = default)
    {
        await studioSettingRepository.UpsertManyAsync(studioId, new Dictionary<string, string?>
        {
            [NotificationEventReminder] = request.EventReminder.ToString(),
            [NotificationPaymentReminder] = request.PaymentReminder.ToString(),
            [NotificationWorkerEventNotification] = request.WorkerEventNotification.ToString(),
            [NotificationQuotationNotification] = request.QuotationNotification.ToString(),
            [NotificationWhatsApp] = request.WhatsAppNotification.ToString()
        }, ct);
        return request;
    }

    public async Task<QuotationSettingsDto> GetQuotationSettingsAsync(int studioId, CancellationToken ct = default)
    {
        var values = await LoadAsync(studioId, ct);
        return new QuotationSettingsDto
        {
            Prefix = GetString(values, QuotationPrefix, "Q-"),
            StartingNumber = GetInt(values, QuotationStartingNumber, 1),
            DefaultTerms = GetString(values, QuotationDefaultTerms, ""),
            DefaultNotes = GetString(values, QuotationDefaultNotes, ""),
            ShowGst = GetBool(values, QuotationShowGst, true),
            ShowAddress = GetBool(values, QuotationShowAddress, true),
            ShowContact = GetBool(values, QuotationShowContact, true),
            ShowLogo = GetBool(values, QuotationShowLogo, true)
        };
    }

    public async Task<QuotationSettingsDto> UpdateQuotationSettingsAsync(int studioId, QuotationSettingsDto request, CancellationToken ct = default)
    {
        await studioSettingRepository.UpsertManyAsync(studioId, new Dictionary<string, string?>
        {
            [QuotationPrefix] = request.Prefix,
            [QuotationStartingNumber] = request.StartingNumber.ToString(CultureInfo.InvariantCulture),
            [QuotationDefaultTerms] = request.DefaultTerms,
            [QuotationDefaultNotes] = request.DefaultNotes,
            [QuotationShowGst] = request.ShowGst.ToString(),
            [QuotationShowAddress] = request.ShowAddress.ToString(),
            [QuotationShowContact] = request.ShowContact.ToString(),
            [QuotationShowLogo] = request.ShowLogo.ToString()
        }, ct);
        return request;
    }

    public async Task<bool> IsNotificationEnabledAsync(int studioId, string notificationType, CancellationToken ct = default)
    {
        var key = notificationType switch
        {
            NotificationTypes.EventReminder => NotificationEventReminder,
            NotificationTypes.PaymentReceived => NotificationPaymentReminder,
            NotificationTypes.QuotationAccepted => NotificationQuotationNotification,
            _ => null
        };
        if (key is null)
        {
            return true;
        }

        var values = await LoadAsync(studioId, ct);
        return GetBool(values, key, true);
    }

    private async Task<Dictionary<string, string?>> LoadAsync(int studioId, CancellationToken ct)
    {
        var rows = await studioSettingRepository.GetAllForStudioAsync(studioId, ct);
        return rows.ToDictionary(r => r.SettingKey, r => r.SettingValue);
    }

    private static string GetString(Dictionary<string, string?> values, string key, string fallback) =>
        values.TryGetValue(key, out var value) && value is not null ? value : fallback;

    private static int GetInt(Dictionary<string, string?> values, string key, int fallback) =>
        values.TryGetValue(key, out var value) && int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) ? parsed : fallback;

    private static decimal GetDecimal(Dictionary<string, string?> values, string key, decimal fallback) =>
        values.TryGetValue(key, out var value) && decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed) ? parsed : fallback;

    private static bool GetBool(Dictionary<string, string?> values, string key, bool fallback) =>
        values.TryGetValue(key, out var value) && bool.TryParse(value, out var parsed) ? parsed : fallback;
}
