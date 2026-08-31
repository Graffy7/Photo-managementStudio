using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;

namespace StudioManagement.Business.Email;

// Used automatically once Email:Smtp:Host is configured (appsettings for non-secret values,
// user-secrets/environment for the username and password — never hard-coded).
public class SmtpEmailSender(IConfiguration configuration) : IEmailSender
{
    public async Task SendAsync(string toEmail, string subject, string body, CancellationToken ct = default)
    {
        var section = configuration.GetSection("Email:Smtp");
        var host = section["Host"]!;
        var port = section.GetValue<int>("Port", 587);
        var username = section["Username"];
        var password = section["Password"];
        var from = section["From"] ?? username!;
        var enableSsl = section.GetValue("EnableSsl", true);

        using var client = new SmtpClient(host, port) { EnableSsl = enableSsl };
        if (!string.IsNullOrEmpty(username))
        {
            client.Credentials = new NetworkCredential(username, password);
        }

        using var message = new MailMessage(from, toEmail, subject, body);
        await client.SendMailAsync(message, ct);
    }
}
