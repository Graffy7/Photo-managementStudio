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
    public const string InProgress = "InProgress";
    public const string Completed = "Completed";
    public const string Cancelled = "Cancelled";

    public static readonly string[] All = [Upcoming, Confirmed, InProgress, Completed, Cancelled];
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
    public const string Refunded = "Refunded";

    public static readonly string[] All = [Completed, Cancelled, Refunded];
}
