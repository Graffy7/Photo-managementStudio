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

// How this studio's quotation PDFs look. Every value is optional: with none set, the PDF looks
// exactly like the original ("Classic") design. Stored per studio, so one studio's branding never
// appears on another's PDFs.
public class PdfSettingsDto
{
    public string Template { get; set; } = "Classic";          // Classic / Modern / Minimal / Elegant
    public string HeaderStyle { get; set; } = "Standard";      // Standard / Banner / Centered
    public string PrimaryColor { get; set; } = "";             // #RRGGBB; empty = the template's own
    public string AccentColor { get; set; } = "";              // #RRGGBB; empty = primary
    public string LogoPlacement { get; set; } = "Watermark";   // Watermark / Header / Both / None

    // Name and contact block (empty = the studio profile's own name).
    public string DisplayName { get; set; } = "";
    public string Tagline { get; set; } = "";
    public bool ShowWebsite { get; set; }

    public string FooterText { get; set; } = "";
    public bool ShowPageNumbers { get; set; } = true;

    // Print the studio's default terms on quotations that have none of their own.
    public bool UseDefaultTerms { get; set; }

    public bool ShowSignature { get; set; }
    public string SignatoryName { get; set; } = "";
    public string SignatoryTitle { get; set; } = "";
    public string? SignatureUrl { get; set; }                   // set by uploading; read-only here

    public bool ShowPaymentDetails { get; set; }
    public string BankName { get; set; } = "";
    public string AccountName { get; set; } = "";
    public string AccountNumber { get; set; } = "";
    public string Ifsc { get; set; } = "";
    public string UpiId { get; set; } = "";
    public string PaymentNote { get; set; } = "";
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
