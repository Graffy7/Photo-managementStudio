namespace StudioManagement.Business.Quotations;

public interface IQuotationPdfService
{
    Task<byte[]> GenerateAsync(int studioId, QuotationDto quotation, CancellationToken ct = default);

    // A sample quotation in the given (possibly unsaved) PDF settings, for the settings preview.
    Task<byte[]> GeneratePreviewAsync(int studioId, Settings.PdfSettingsDto draft, CancellationToken ct = default);
}
