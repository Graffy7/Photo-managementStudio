namespace StudioManagement.Business.Customers;

// Another customer of the studio already has this mobile number; found under the mobile-number lock,
// so two devices saving the same new customer at the same moment can't both succeed.
public class DuplicateCustomerException(CustomerDto existing) : Exception("A customer with this mobile number already exists.")
{
    public CustomerDto Existing { get; } = existing;
}
