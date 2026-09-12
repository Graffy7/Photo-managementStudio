namespace StudioManagement.Business.Settings;

public class BusinessSettingsDto
{
    public int QuotationValidityDays { get; set; }
    public string Currency { get; set; } = null!;
    public decimal TaxPercentage { get; set; }
    public string PaymentTerms { get; set; } = null!;
    public decimal AdvancePaymentPercentage { get; set; }
    public string DateFormat { get; set; } = null!;
    public string TimeFormat { get; set; } = null!;
}

public class NotificationSettingsDto
{
    public bool EventReminder { get; set; }
    public bool PaymentReminder { get; set; }
    public bool WorkerEventNotification { get; set; }
    public bool QuotationNotification { get; set; }

    // Stored for forward compatibility only — there is no WhatsApp Business API integration in
    // this app yet, so toggling this on does not actually send any WhatsApp message today.
    public bool WhatsAppNotification { get; set; }
}

public class QuotationSettingsDto
{
    public string Prefix { get; set; } = null!;
    public int StartingNumber { get; set; }
    public string DefaultTerms { get; set; } = null!;
    public string DefaultNotes { get; set; } = null!;
    public bool ShowGst { get; set; }
    public bool ShowAddress { get; set; }
    public bool ShowContact { get; set; }
    public bool ShowLogo { get; set; }
}
