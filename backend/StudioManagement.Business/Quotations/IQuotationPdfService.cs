namespace StudioManagement.Business.Quotations;

public interface IQuotationPdfService
{
    Task<byte[]> GenerateAsync(int studioId, QuotationDto quotation, CancellationToken ct = default);
}
