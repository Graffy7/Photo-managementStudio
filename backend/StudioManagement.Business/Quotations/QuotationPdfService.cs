using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using StudioManagement.Business.Settings;
using StudioManagement.Business.Storage;
using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.Quotations;

public class QuotationPdfService(
    IStudioRepository studioRepository,
    IStudioSettingsService studioSettingsService,
    IFileStorage fileStorage) : IQuotationPdfService
{
    public async Task<byte[]> GenerateAsync(int studioId, QuotationDto quotation, CancellationToken ct = default)
    {
        var studio = await studioRepository.GetByIdAsync(studioId, ct);
        var settings = await studioSettingsService.GetQuotationSettingsAsync(studioId, ct);
        var rawLogoBytes = settings.ShowLogo && !string.IsNullOrWhiteSpace(studio?.LogoUrl)
            ? await fileStorage.ReadAsync(studio.LogoUrl, ct)
            : null;
        // QuestPDF has no native opacity/transparency API for images — the watermark effect is
        // baked into the pixels themselves (re-encoded as PNG, which supports alpha) before handing
        // the bytes to QuestPDF.
        var logoBytes = rawLogoBytes is not null ? ApplyWatermarkOpacity(rawLogoBytes, 0.35f) : null;

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(x => x.FontSize(10).FontColor(Colors.Grey.Darken3));

                // A large, faint centered watermark rather than a small header logo — sits behind
                // both the header and content since QuestPDF layers Background beneath everything.
                if (logoBytes is not null)
                {
                    page.Background().AlignCenter().AlignMiddle().Width(320).Image(logoBytes).FitWidth();
                }

                page.Header().Row(row =>
                {
                    row.RelativeItem().Column(col =>
                    {
                        col.Item().Text(studio?.StudioName ?? "Studio").FontSize(18).Bold().FontColor(Colors.Blue.Darken2);
                        if (settings.ShowAddress && !string.IsNullOrWhiteSpace(studio?.Address))
                        {
                            var addressLine = string.Join(", ", new[] { studio.Address, studio.City, studio.State, studio.Pincode }.Where(s => !string.IsNullOrWhiteSpace(s)));
                            col.Item().Text(addressLine).FontSize(9).FontColor(Colors.Grey.Darken1);
                        }
                        if (settings.ShowContact)
                        {
                            var contact = string.Join(" · ", new[] { studio?.PhoneNumber, studio?.Email }.Where(s => !string.IsNullOrWhiteSpace(s)));
                            if (!string.IsNullOrWhiteSpace(contact))
                            {
                                col.Item().Text(contact).FontSize(9).FontColor(Colors.Grey.Darken1);
                            }
                        }
                        if (settings.ShowGst && !string.IsNullOrWhiteSpace(studio?.GstNumber))
                        {
                            col.Item().Text($"GSTIN: {studio.GstNumber}").FontSize(9).FontColor(Colors.Grey.Darken1);
                        }
                    });

                    row.ConstantItem(180).Column(col =>
                    {
                        col.Item().AlignRight().Text("QUOTATION").FontSize(16).Bold();
                        col.Item().AlignRight().Text(quotation.QuotationNumber).FontSize(11).FontColor(Colors.Grey.Darken1);
                        col.Item().AlignRight().Text($"Date: {quotation.QuotationDate:dd MMM yyyy}").FontSize(9);
                        if (quotation.ValidUntil is not null)
                        {
                            col.Item().AlignRight().Text($"Valid until: {quotation.ValidUntil:dd MMM yyyy}").FontSize(9);
                        }
                        col.Item().AlignRight().Text(quotation.Status).FontSize(10).Bold().FontColor(Colors.Blue.Medium);
                    });
                });

                page.Content().PaddingTop(20).Column(col =>
                {
                    col.Spacing(16);

                    col.Item().Column(bill =>
                    {
                        bill.Item().Text("Bill To").FontSize(9).Bold().FontColor(Colors.Grey.Darken1);
                        bill.Item().Text(quotation.CustomerName).FontSize(12).Bold();
                        bill.Item().Text(quotation.CustomerMobileNumber).FontSize(9);
                        if (!string.IsNullOrWhiteSpace(quotation.EventVenue))
                        {
                            bill.Item().Text($"Venue: {quotation.EventVenue}").FontSize(9);
                        }
                    });

                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(4);
                            columns.RelativeColumn(1);
                            columns.RelativeColumn(1.5f);
                            columns.RelativeColumn(1.5f);
                        });

                        table.Header(header =>
                        {
                            header.Cell().Element(HeaderCell).Text("Service");
                            header.Cell().Element(HeaderCell).AlignRight().Text("Qty");
                            header.Cell().Element(HeaderCell).AlignRight().Text("Unit price");
                            header.Cell().Element(HeaderCell).AlignRight().Text("Total");

                            static IContainer HeaderCell(IContainer c) =>
                                c.DefaultTextStyle(x => x.Bold().FontColor(Colors.White)).Background(Colors.Blue.Darken2).Padding(6);
                        });

                        foreach (var item in quotation.Items)
                        {
                            table.Cell().Element(BodyCell).Column(c =>
                            {
                                c.Item().Text(item.ServiceName);
                                if (!string.IsNullOrWhiteSpace(item.Notes))
                                {
                                    c.Item().Text(item.Notes).FontSize(8).FontColor(Colors.Grey.Darken1);
                                }
                            });
                            table.Cell().Element(BodyCell).AlignRight().Text(item.Quantity.ToString("0.##"));
                            table.Cell().Element(BodyCell).AlignRight().Text(FormatCurrency(item.UnitPrice));
                            table.Cell().Element(BodyCell).AlignRight().Text(FormatCurrency(item.Total));

                            static IContainer BodyCell(IContainer c) =>
                                c.BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(6);
                        }
                    });

                    col.Item().AlignRight().Width(220).Column(totals =>
                    {
                        totals.Item().Row(r =>
                        {
                            r.RelativeItem().Text("Subtotal");
                            r.ConstantItem(100).AlignRight().Text(FormatCurrency(quotation.Subtotal));
                        });
                        if (quotation.Discount != 0)
                        {
                            totals.Item().Row(r =>
                            {
                                r.RelativeItem().Text("Discount");
                                r.ConstantItem(100).AlignRight().Text($"-{FormatCurrency(quotation.Discount)}");
                            });
                        }
                        if (quotation.TaxAmount != 0)
                        {
                            totals.Item().Row(r =>
                            {
                                r.RelativeItem().Text("Tax");
                                r.ConstantItem(100).AlignRight().Text(FormatCurrency(quotation.TaxAmount));
                            });
                        }
                        totals.Item().PaddingTop(4).BorderTop(1).BorderColor(Colors.Grey.Lighten1).Row(r =>
                        {
                            r.RelativeItem().Text("Grand total").Bold();
                            r.ConstantItem(100).AlignRight().Text(FormatCurrency(quotation.GrandTotal)).Bold().FontColor(Colors.Blue.Darken2);
                        });
                    });

                    if (!string.IsNullOrWhiteSpace(quotation.TermsAndConditions))
                    {
                        col.Item().Column(terms =>
                        {
                            terms.Item().Text("Terms & Conditions").FontSize(9).Bold().FontColor(Colors.Grey.Darken1);
                            terms.Item().Text(quotation.TermsAndConditions).FontSize(9);
                        });
                    }
                });

                page.Footer().AlignCenter().Text(x =>
                {
                    x.Span("Page ").FontSize(8);
                    x.CurrentPageNumber().FontSize(8);
                    x.Span(" of ").FontSize(8);
                    x.TotalPages().FontSize(8);
                });
            });
        });

        return document.GeneratePdf();
    }

    private static byte[] ApplyWatermarkOpacity(byte[] sourceBytes, float opacity)
    {
        using var image = SixLabors.ImageSharp.Image.Load<Rgba32>(sourceBytes);
        image.Mutate(ctx => ctx.Opacity(opacity));
        using var output = new MemoryStream();
        image.Save(output, new PngEncoder());
        return output.ToArray();
    }

    private static string FormatCurrency(decimal value) => $"Rs. {value:N0}";
}
