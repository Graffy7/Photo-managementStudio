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
