namespace StudioManagement.Data.Common;

public static class UserTypes
{
    public const string SuperAdmin = "SUPER_ADMIN";
    public const string StudioOwner = "STUDIO_OWNER";

    public static readonly string[] All = [SuperAdmin, StudioOwner];
}

public static class SubscriptionPlanTypes
{
    public const string Monthly = "Monthly";
    public const string Yearly = "Yearly";
    public const string Custom = "Custom";

    public static readonly string[] All = [Monthly, Yearly, Custom];
}

public static class SubscriptionStatuses
{
    public const string Active = "Active";
    public const string Expired = "Expired";
    public const string Cancelled = "Cancelled";

    public static readonly string[] All = [Active, Expired, Cancelled];
}

public static class EventStatuses
{
    public const string Upcoming = "Upcoming";
    public const string Confirmed = "Confirmed";
    public const string Completed = "Completed";
    public const string Cancelled = "Cancelled";

    public static readonly string[] All = [Upcoming, Confirmed, Completed, Cancelled];
}

public static class QuotationStatuses
{
    public const string Draft = "Draft";
    public const string Sent = "Sent";
    public const string Accepted = "Accepted";
    public const string Rejected = "Rejected";
    public const string Expired = "Expired";
    public const string Cancelled = "Cancelled";

    public static readonly string[] All = [Draft, Sent, Accepted, Rejected, Expired, Cancelled];
}

public static class PaymentMethods
{
    public const string Cash = "Cash";
    public const string Upi = "UPI";
    public const string BankTransfer = "BankTransfer";
    public const string Card = "Card";
    public const string Other = "Other";

    public static readonly string[] All = [Cash, Upi, BankTransfer, Card, Other];
}

public static class PaymentStatuses
{
    public const string Completed = "Completed";
    public const string Cancelled = "Cancelled";
    public const string Pending = "Pending";

    public static readonly string[] All = [Completed, Cancelled, Pending];
}

public static class NotificationTypes
{
    public const string LeadCreated = "LeadCreated";
    public const string LeadConverted = "LeadConverted";
    public const string QuotationAccepted = "QuotationAccepted";
    public const string PaymentReceived = "PaymentReceived";
    public const string EventReminder = "EventReminder";
    public const string PhotoSelectionSubmitted = "PhotoSelectionSubmitted";
}

// How long a customer photo-selection link can stay valid (days). 5 is the default selection period.
public static class LinkPeriods
{
    public const int Default = 5;
    public static readonly int[] Allowed = [5, 10];
}

public static class GalleryStatuses
{
    public const string Open = "Open";
    public const string Locked = "Locked";

    public static readonly string[] All = [Open, Locked];
}

// Stored as a small int (1/2) on PhotoSelections; the labels are what customers and owners see.
public static class SelectionTypes
{
    public const int Normal = 1;
    public const int Big = 2;

    public static bool IsValid(int value) => value is Normal or Big;
    public static string Label(int value) => value == Big ? "Big" : "Normal";
}

public static class ImportJobStatuses
{
    public const string Queued = "Queued";
    public const string Running = "Running";
    public const string Completed = "Completed";
    public const string CompletedWithErrors = "CompletedWithErrors";
    public const string Failed = "Failed";

    public static readonly string[] All = [Queued, Running, Completed, CompletedWithErrors, Failed];
}

public static class FieldTypes
{
    public const string Text = "TEXT";
    public const string TextArea = "TEXTAREA";
    public const string Number = "NUMBER";
    public const string Date = "DATE";
    public const string DateTime = "DATETIME";
    public const string Dropdown = "DROPDOWN";
    public const string MultiSelect = "MULTISELECT";
    public const string Checkbox = "CHECKBOX";
    public const string Radio = "RADIO";
    public const string Switch = "SWITCH";
    public const string Email = "EMAIL";
    public const string Phone = "PHONE";

    public static readonly string[] All =
        [Text, TextArea, Number, Date, DateTime, Dropdown, MultiSelect, Checkbox, Radio, Switch, Email, Phone];
}

public static class CopyJobKinds
{
    public const string Create = "Create";
    public const string Sync = "Sync";

    public static readonly string[] All = [Create, Sync];
}

public static class WhatsAppReminderTypes
{
    public const string TomorrowEvent = "TomorrowEvent";
    public const string TomorrowPayment = "TomorrowPayment";

    public static readonly string[] All = [TomorrowEvent, TomorrowPayment];
}

// The delivery checklist every completed event starts with. Studios can add their own items on
// top (a pendrive, a frame, a photo book); those are stored with no key so they can be removed
// again without disturbing these three.
public static class DeliveryItems
{
    public const string Album = "Album";
    public const string Video = "Video";
    public const string Photos = "Photos";

    public static readonly string[] Defaults = [Album, Video, Photos];
}

public static class WhatsAppRecipientTypes
{
    public const string Owner = "Owner";
    public const string Worker = "Worker";

    public static readonly string[] All = [Owner, Worker];
}

public static class WhatsAppLogStatuses
{
    public const string Sent = "Sent";
    public const string Failed = "Failed";
    public const string Skipped = "Skipped";

    public static readonly string[] All = [Sent, Failed, Skipped];
}
