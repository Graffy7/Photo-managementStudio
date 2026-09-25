using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using StudioManagement.Business.Settings;
using Color = QuestPDF.Infrastructure.Color;
using StudioManagement.Business.Storage;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.Quotations;

// Renders a quotation as a PDF in the owning studio's own style. Everything visual comes from that
// studio's settings, profile, logo and signature - loaded by the studio id the quotation belongs
// to - so one studio's branding can never appear on another's PDF. The quotation's figures are
// printed exactly as stored; nothing is recalculated here. With no PDF settings saved the output
// is the original ("Classic") design.
public class QuotationPdfService(
    IStudioRepository studioRepository,
    IStudioSettingsService studioSettingsService,
    IFileStorage fileStorage) : IQuotationPdfService
{
    public async Task<byte[]> GenerateAsync(int studioId, QuotationDto quotation, CancellationToken ct = default)
    {
        var pdf = await studioSettingsService.GetPdfSettingsAsync(studioId, ct);
        return await RenderAsync(studioId, quotation, pdf, sample: false, ct);
    }

    // The studio's current (possibly unsaved) PDF settings applied to a made-up quotation, so the
    // owner can see the result before saving.
    public Task<byte[]> GeneratePreviewAsync(int studioId, PdfSettingsDto draft, CancellationToken ct = default)
    {
        var today = DateTime.Today;
        var sample = new QuotationDto
        {
            QuotationNumber = "SAMPLE-001",
            CustomerName = "Sample Customer",
            CustomerMobileNumber = "98765 43210",
            EventVenue = "Sample Venue, City",
            QuotationDate = today,
            ValidUntil = today.AddDays(15),
            Status = "Draft",
            Items =
            [
                new() { ServiceName = "Candid Photography", Quantity = 1, UnitPrice = 45000, Total = 45000, Notes = "Full-day coverage, 2 photographers" },
                new() { ServiceName = "Cinematic Video", Quantity = 1, UnitPrice = 35000, Total = 35000 },
                new() { ServiceName = "Premium Album (40 sheets)", Quantity = 2, UnitPrice = 12500, Total = 25000 }
            ],
            Subtotal = 105000,
            Discount = 5000,
            TaxAmount = 0,
            GrandTotal = 100000,
            TermsAndConditions = null
        };
        return RenderAsync(studioId, sample, draft, sample: true, ct);
    }

    private async Task<byte[]> RenderAsync(int studioId, QuotationDto quotation, PdfSettingsDto pdf, bool sample, CancellationToken ct)
    {
        var studio = await studioRepository.GetByIdAsync(studioId, ct);
        var settings = await studioSettingsService.GetQuotationSettingsAsync(studioId, ct);

        var logoPlacement = settings.ShowLogo ? pdf.LogoPlacement : "None";
        var rawLogoBytes = logoPlacement != "None" && !string.IsNullOrWhiteSpace(studio?.LogoUrl)
            ? await fileStorage.ReadAsync(studio.LogoUrl, ct)
            : null;
        // QuestPDF has no native opacity/transparency API for images — the watermark effect is
        // baked into the pixels themselves (re-encoded as PNG, which supports alpha) before handing
        // the bytes to QuestPDF.
        var watermarkBytes = rawLogoBytes is not null && logoPlacement is "Watermark" or "Both" ? ApplyWatermarkOpacity(rawLogoBytes, 0.35f) : null;
        var headerLogoBytes = logoPlacement is "Header" or "Both" ? rawLogoBytes : null;

        // The signature image is this studio's own upload (its path is stored in its settings).
        var signatureBytes = pdf.ShowSignature && !string.IsNullOrWhiteSpace(pdf.SignatureUrl)
            ? await fileStorage.ReadAsync(pdf.SignatureUrl, ct)
            : null;

        var terms = !string.IsNullOrWhiteSpace(quotation.TermsAndConditions)
            ? quotation.TermsAndConditions
            : pdf.UseDefaultTerms && !string.IsNullOrWhiteSpace(settings.DefaultTerms) ? settings.DefaultTerms : null;

        var s = Style.From(pdf);
        var name = !string.IsNullOrWhiteSpace(pdf.DisplayName) ? pdf.DisplayName : studio?.StudioName ?? "Studio";

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(x => x.FontSize(10).FontColor(Colors.Grey.Darken3));

                // A large, faint centered watermark — sits behind both the header and content since
                // QuestPDF layers Background beneath everything.
                if (watermarkBytes is not null)
                {
                    page.Background().AlignCenter().AlignMiddle().Width(320).Image(watermarkBytes).FitWidth();
                }

                page.Header().Element(h => Header(h, s, pdf, studio, settings, quotation, name, headerLogoBytes));
                page.Content().PaddingTop(20).Column(col =>
                {
                    col.Spacing(16);

                    if (sample)
                    {
                        col.Item().Background(Colors.Yellow.Lighten4).Padding(6).AlignCenter()
                            .Text("SAMPLE PREVIEW — not a real quotation").FontSize(9).Bold().FontColor(Colors.Orange.Darken3);
                    }

                    col.Item().Column(bill =>
                    {
                        bill.Item().Text("Bill To").FontSize(9).Bold().FontColor(s.Label);
                        bill.Item().Text(quotation.CustomerName).FontSize(12).Bold();
                        bill.Item().Text(quotation.CustomerMobileNumber).FontSize(9);
                        if (!string.IsNullOrWhiteSpace(quotation.EventVenue))
                        {
                            bill.Item().Text($"Venue: {quotation.EventVenue}").FontSize(9);
                        }
                    });

                    // "Total only": the services are listed without prices and one total follows. The
                    // quotation's stored items and figures are the same either way.
                    if (quotation.PriceDisplay == Data.Common.QuotationPriceDisplays.TotalOnly)
                    {
                        col.Item().Element(c => ServicesOnlyTable(c, s, quotation));
                        col.Item().Element(c => TotalOnly(c, s, quotation));
                    }
                    else
                    {
                        col.Item().Element(c => ItemsTable(c, s, quotation));
                        col.Item().Element(c => Totals(c, s, quotation));
                    }

                    if (terms is not null)
                    {
                        col.Item().Column(t =>
                        {
                            t.Item().Text("Terms & Conditions").FontSize(9).Bold().FontColor(s.Label);
                            t.Item().Text(terms).FontSize(9);
                        });
                    }

                    var payment = pdf.ShowPaymentDetails && HasPaymentDetails(pdf);
                    var signature = pdf.ShowSignature && (signatureBytes is not null || !string.IsNullOrWhiteSpace(pdf.SignatoryName));
                    if (payment || signature)
                    {
                        col.Item().PaddingTop(6).Row(row =>
                        {
                            if (payment) row.RelativeItem().Element(c => PaymentDetails(c, s, pdf));
                            else row.RelativeItem();
                            if (signature) row.ConstantItem(190).Element(c => Signature(c, s, pdf, signatureBytes, name));
                        });
                    }
                });

                page.Footer().Column(f =>
                {
                    if (!string.IsNullOrWhiteSpace(pdf.FooterText))
                    {
                        f.Item().PaddingBottom(4).AlignCenter().Text(pdf.FooterText).FontSize(8).FontColor(s.Label);
                    }
                    if (pdf.ShowPageNumbers)
                    {
                        f.Item().AlignCenter().Text(x =>
                        {
                            x.Span("Page ").FontSize(8);
                            x.CurrentPageNumber().FontSize(8);
                            x.Span(" of ").FontSize(8);
                            x.TotalPages().FontSize(8);
                        });
                    }
                });
            });
        });

        return document.GeneratePdf();
    }

    // ---- Pieces ----------------------------------------------------------------------------------

    private static void Header(IContainer c, Style s, PdfSettingsDto pdf, Studio? studio, QuotationSettingsDto settings, QuotationDto q, string name, byte[]? logo)
    {
        var onBanner = pdf.HeaderStyle == "Banner";
        var textMuted = onBanner ? Colors.Grey.Lighten3 : Colors.Grey.Darken1;
        var lines = StudioLines(studio, settings, pdf);

        void StudioBlock(ColumnDescriptor col, bool centered)
        {
            var nameItem = col.Item();
            (centered ? nameItem.AlignCenter() : nameItem).Text(name).FontSize(18).Bold().FontColor(onBanner ? Colors.White : s.Primary);
            if (!string.IsNullOrWhiteSpace(pdf.Tagline))
            {
                var t = col.Item();
                (centered ? t.AlignCenter() : t).Text(pdf.Tagline).FontSize(9).Italic().FontColor(textMuted);
            }
            foreach (var line in lines)
            {
                var i = col.Item();
                (centered ? i.AlignCenter() : i).Text(line).FontSize(9).FontColor(textMuted);
            }
        }

        void QuotationBlock(ColumnDescriptor col, bool alignRight)
        {
            IContainer A(IContainer i) => alignRight ? i.AlignRight() : i.AlignCenter();
            col.Item().Element(A).Text("QUOTATION").FontSize(16).Bold().FontColor(onBanner ? Colors.White : Colors.Grey.Darken3);
            col.Item().Element(A).Text(q.QuotationNumber).FontSize(11).FontColor(textMuted);
            col.Item().Element(A).Text($"Date: {q.QuotationDate:dd MMM yyyy}").FontSize(9).FontColor(onBanner ? Colors.White : Colors.Grey.Darken3);
            if (q.ValidUntil is not null)
            {
                col.Item().Element(A).Text($"Valid until: {q.ValidUntil:dd MMM yyyy}").FontSize(9).FontColor(onBanner ? Colors.White : Colors.Grey.Darken3);
            }
            col.Item().Element(A).Text(q.Status).FontSize(10).Bold().FontColor(onBanner ? Colors.White : s.Status);
        }

        switch (pdf.HeaderStyle)
        {
            case "Centered":
                c.Column(col =>
                {
                    if (logo is not null) col.Item().AlignCenter().Height(52).Image(logo).FitHeight();
                    StudioBlock(col, centered: true);
                    col.Item().PaddingVertical(8).LineHorizontal(1.2f).LineColor(s.Accent);
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(l =>
                        {
                            l.Item().Text("QUOTATION").FontSize(14).Bold();
                            l.Item().Text(q.QuotationNumber).FontSize(10).FontColor(Colors.Grey.Darken1);
                        });
                        row.RelativeItem().Column(r =>
                        {
                            r.Item().AlignRight().Text($"Date: {q.QuotationDate:dd MMM yyyy}").FontSize(9);
                            if (q.ValidUntil is not null) r.Item().AlignRight().Text($"Valid until: {q.ValidUntil:dd MMM yyyy}").FontSize(9);
                            r.Item().AlignRight().Text(q.Status).FontSize(10).Bold().FontColor(s.Status);
                        });
                    });
                });
                break;

            case "Banner":
                c.Background(s.Primary).Padding(16).Row(row =>
                {
                    if (logo is not null) row.ConstantItem(64).PaddingRight(12).AlignMiddle().Height(48).Image(logo).FitArea();
                    row.RelativeItem().Column(col => StudioBlock(col, centered: false));
                    row.ConstantItem(170).Column(col => QuotationBlock(col, alignRight: true));
                });
                break;

            default: // Standard - the original layout
                c.Row(row =>
                {
                    if (logo is not null) row.ConstantItem(64).PaddingRight(12).Height(48).Image(logo).FitArea();
                    row.RelativeItem().Column(col => StudioBlock(col, centered: false));
                    row.ConstantItem(180).Column(col => QuotationBlock(col, alignRight: true));
                });
                break;
        }
    }

    private static List<string> StudioLines(Studio? studio, QuotationSettingsDto settings, PdfSettingsDto pdf)
    {
        var lines = new List<string>();
        if (settings.ShowAddress && !string.IsNullOrWhiteSpace(studio?.Address))
        {
            lines.Add(string.Join(", ", new[] { studio.Address, studio.City, studio.State, studio.Pincode }.Where(x => !string.IsNullOrWhiteSpace(x))));
        }
        if (settings.ShowContact)
        {
            var contact = string.Join(" · ", new[] { studio?.PhoneNumber, studio?.Email }.Where(x => !string.IsNullOrWhiteSpace(x)));
            if (!string.IsNullOrWhiteSpace(contact)) lines.Add(contact);
        }
        if (pdf.ShowWebsite && !string.IsNullOrWhiteSpace(studio?.Website))
        {
            lines.Add(studio.Website);
        }
        if (settings.ShowGst && !string.IsNullOrWhiteSpace(studio?.GstNumber))
        {
            lines.Add($"GSTIN: {studio.GstNumber}");
        }
        return lines;
    }

    private static void ItemsTable(IContainer c, Style s, QuotationDto q)
    {
        c.Table(table =>
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
            });

            var i = 0;
            foreach (var item in q.Items)
            {
                var zebra = s.Zebra && i++ % 2 == 1;
                table.Cell().Element(x => BodyCell(x, zebra)).Column(col =>
                {
                    col.Item().Text(item.ServiceName);
                    if (!string.IsNullOrWhiteSpace(item.Notes))
                    {
                        col.Item().Text(item.Notes).FontSize(8).FontColor(Colors.Grey.Darken1);
                    }
                });
                table.Cell().Element(x => BodyCell(x, zebra)).AlignRight().Text(item.Quantity.ToString("0.##"));
                table.Cell().Element(x => BodyCell(x, zebra)).AlignRight().Text(FormatCurrency(item.UnitPrice));
                table.Cell().Element(x => BodyCell(x, zebra)).AlignRight().Text(FormatCurrency(item.Total));
            }
        });

        IContainer HeaderCell(IContainer x) => s.TableHeader switch
        {
            "Line" => x.DefaultTextStyle(t => t.Bold().FontColor(s.Primary)).BorderBottom(1.5f).BorderColor(s.Primary).Padding(6),
            "Tint" => x.DefaultTextStyle(t => t.Bold().FontColor(s.Primary)).Background(s.Tint).Padding(6),
            _ => x.DefaultTextStyle(t => t.Bold().FontColor(Colors.White)).Background(s.Primary).Padding(6)
        };

        IContainer BodyCell(IContainer x, bool zebra)
        {
            var cell = x.BorderBottom(1).BorderColor(Colors.Grey.Lighten2);
            if (zebra) cell = cell.Background(s.Tint);
            return cell.Padding(6);
        }
    }

    private static void ServicesOnlyTable(IContainer c, Style s, QuotationDto q)
    {
        c.Table(table =>
        {
            table.ColumnsDefinition(columns => columns.RelativeColumn());
            table.Header(header => header.Cell().Element(x => s.TableHeader switch
            {
                "Line" => x.DefaultTextStyle(t => t.Bold().FontColor(s.Primary)).BorderBottom(1.5f).BorderColor(s.Primary).Padding(6),
                "Tint" => x.DefaultTextStyle(t => t.Bold().FontColor(s.Primary)).Background(s.Tint).Padding(6),
                _ => x.DefaultTextStyle(t => t.Bold().FontColor(Colors.White)).Background(s.Primary).Padding(6)
            }).Text("Services included"));

            var i = 0;
            foreach (var item in q.Items)
            {
                var zebra = s.Zebra && i++ % 2 == 1;
                var cell = table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2);
                if (zebra) cell = cell.Background(s.Tint);
                cell.Padding(6).Column(col =>
                {
                    // Quantity is kept when it's more than one (e.g. "Premium Album × 2") - it's what
                    // the customer gets, not a price.
                    col.Item().Text(item.Quantity == 1 ? item.ServiceName : $"{item.ServiceName} × {item.Quantity:0.##}");
                    if (!string.IsNullOrWhiteSpace(item.Notes))
                    {
                        col.Item().Text(item.Notes).FontSize(8).FontColor(Colors.Grey.Darken1);
                    }
                });
            }
        });
    }

    private static void TotalOnly(IContainer c, Style s, QuotationDto q)
    {
        c.AlignRight().Width(260).Element(x => s.FilledTotal ? x.Background(s.Primary).Padding(8) : x.BorderTop(1).BorderColor(Colors.Grey.Lighten1).PaddingTop(6))
            .Row(r =>
            {
                r.RelativeItem().Text("Total Amount").Bold().FontSize(12).FontColor(s.FilledTotal ? Colors.White : Colors.Grey.Darken3);
                r.ConstantItem(120).AlignRight().Text(FormatCurrency(q.GrandTotal)).Bold().FontSize(12).FontColor(s.FilledTotal ? Colors.White : s.Primary);
            });
    }

    private static void Totals(IContainer c, Style s, QuotationDto q)
    {
        c.AlignRight().Width(220).Column(totals =>
        {
            totals.Item().Row(r =>
            {
                r.RelativeItem().Text("Subtotal");
                r.ConstantItem(100).AlignRight().Text(FormatCurrency(q.Subtotal));
            });
            if (q.Discount != 0)
            {
                totals.Item().Row(r =>
                {
                    r.RelativeItem().Text("Discount");
                    r.ConstantItem(100).AlignRight().Text($"-{FormatCurrency(q.Discount)}");
                });
            }
            if (q.TaxAmount != 0)
            {
                totals.Item().Row(r =>
                {
                    r.RelativeItem().Text("Tax");
                    r.ConstantItem(100).AlignRight().Text(FormatCurrency(q.TaxAmount));
                });
            }

            if (s.FilledTotal)
            {
                totals.Item().PaddingTop(6).Background(s.Primary).Padding(6).Row(r =>
                {
                    r.RelativeItem().Text("Grand total").Bold().FontColor(Colors.White);
                    r.ConstantItem(100).AlignRight().Text(FormatCurrency(q.GrandTotal)).Bold().FontColor(Colors.White);
                });
            }
            else
            {
                totals.Item().PaddingTop(4).BorderTop(1).BorderColor(Colors.Grey.Lighten1).Row(r =>
                {
                    r.RelativeItem().Text("Grand total").Bold();
                    r.ConstantItem(100).AlignRight().Text(FormatCurrency(q.GrandTotal)).Bold().FontColor(s.Primary);
                });
            }
        });
    }

    private static bool HasPaymentDetails(PdfSettingsDto p) =>
        new[] { p.BankName, p.AccountName, p.AccountNumber, p.Ifsc, p.UpiId, p.PaymentNote }.Any(x => !string.IsNullOrWhiteSpace(x));

    private static void PaymentDetails(IContainer c, Style s, PdfSettingsDto p)
    {
        c.Border(1).BorderColor(Colors.Grey.Lighten2).Padding(10).Column(col =>
        {
            col.Spacing(2);
            col.Item().PaddingBottom(4).Text("Payment details").FontSize(9).Bold().FontColor(s.Primary);
            void Line(string label, string value)
            {
                if (string.IsNullOrWhiteSpace(value)) return;
                col.Item().Text(t =>
                {
                    t.Span($"{label}: ").FontSize(9).FontColor(Colors.Grey.Darken1);
                    t.Span(value).FontSize(9).SemiBold();
                });
            }
            Line("Bank", p.BankName);
            Line("Account name", p.AccountName);
            Line("Account no.", p.AccountNumber);
            Line("IFSC", p.Ifsc.ToUpperInvariant());
            Line("UPI", p.UpiId);
            if (!string.IsNullOrWhiteSpace(p.PaymentNote))
            {
                col.Item().PaddingTop(4).Text(p.PaymentNote).FontSize(8).FontColor(Colors.Grey.Darken1);
            }
        });
    }

    private static void Signature(IContainer c, Style s, PdfSettingsDto p, byte[]? image, string studioName)
    {
        c.PaddingLeft(20).AlignBottom().Column(col =>
        {
            col.Item().AlignRight().Text($"For {studioName}").FontSize(9).FontColor(Colors.Grey.Darken1);
            if (image is not null)
            {
                col.Item().AlignRight().Height(50).Image(image).FitHeight();
            }
            else
            {
                col.Item().Height(40);
            }
            col.Item().LineHorizontal(0.8f).LineColor(Colors.Grey.Darken1);
            if (!string.IsNullOrWhiteSpace(p.SignatoryName)) col.Item().AlignRight().Text(p.SignatoryName).FontSize(9).Bold();
            col.Item().AlignRight().Text(string.IsNullOrWhiteSpace(p.SignatoryTitle) ? "Authorised signatory" : p.SignatoryTitle).FontSize(8).FontColor(Colors.Grey.Darken1);
        });
    }

    // ---- Style -----------------------------------------------------------------------------------

    // What each template changes. Classic reproduces the original design exactly.
    private sealed record Style(Color Primary, Color Accent, Color Status, Color Tint, Color Label, string TableHeader, bool Zebra, bool FilledTotal)
    {
        public static Style From(PdfSettingsDto p)
        {
            var (defaultPrimary, tableHeader, zebra, filledTotal) = p.Template switch
            {
                "Modern" => ("#1F3A5F", "Filled", true, true),
                "Minimal" => ("#263238", "Line", false, false),
                "Elegant" => ("#6D4C41", "Tint", false, false),
                _ => ((string?)null, "Filled", false, false)  // Classic
            };

            Color primary = IsHex(p.PrimaryColor) ? Color.FromHex(p.PrimaryColor) : defaultPrimary is null ? Colors.Blue.Darken2 : Color.FromHex(defaultPrimary);
            var primaryHex = IsHex(p.PrimaryColor) ? p.PrimaryColor : defaultPrimary ?? "#1976D2";
            Color accent = IsHex(p.AccentColor) ? Color.FromHex(p.AccentColor) : primary;
            // Classic keeps its original status colour unless a colour was chosen.
            Color status = p.Template == "Classic" && !IsHex(p.PrimaryColor) && !IsHex(p.AccentColor) ? Colors.Blue.Medium : accent;
            return new Style(primary, accent, status, Color.FromHex(Mix(primaryHex, 0.9)), Colors.Grey.Darken1, tableHeader, zebra, filledTotal);
        }

        private static bool IsHex(string? v) => !string.IsNullOrWhiteSpace(v) && v.Length == 7 && v[0] == '#' && v.Skip(1).All(Uri.IsHexDigit);

        // The colour blended towards white (0 = unchanged, 1 = white), for soft backgrounds.
        private static string Mix(string hex, double toWhite)
        {
            int Ch(int i) => Convert.ToInt32(hex.Substring(i, 2), 16);
            int M(int v) => (int)Math.Round(v + (255 - v) * toWhite);
            return $"#{M(Ch(1)):X2}{M(Ch(3)):X2}{M(Ch(5)):X2}";
        }
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
