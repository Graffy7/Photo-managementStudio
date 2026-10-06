using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using StudioManagement.API.Infrastructure;
using StudioManagement.Business.Common;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Middleware;

// Turns exceptions into clean JSON answers. Expected outcomes (someone else changed or deleted the
// record, a duplicate, a busy lock, an id that isn't the studio's) get a 4xx with a plain message and a
// one-line log; only genuinely unexpected errors are 500. Nothing internal (SQL, stack traces, paths)
// ever reaches the client. Repeated identical failures log their stack trace once a minute, not per
// request, so an error storm can't fill the disk.
public class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    private static readonly TimeSpan StackTraceEvery = TimeSpan.FromMinutes(1);
    private static readonly ConcurrentDictionary<string, (DateTime LastFull, int Suppressed)> Recent = new();

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // The caller went away (closed the tab, timed out); nothing to answer and nothing wrong.
            context.Response.StatusCode = 499;
        }
        catch (Exception ex)
        {
            var path = LogSanitizer.Path(context.Request.Path);
            var (status, message, code, field) = Classify(ex, context.Request.Method);
            if (context.Response.HasStarted)
            {
                logger.LogWarning("Response already started when {ExceptionType} occurred on {Method} {Path}", ex.GetType().Name, context.Request.Method, path);
                throw;
            }

            if (status >= 500)
            {
                LogUnexpected(ex, context.Request.Method, path);
            }
            else
            {
                logger.LogWarning("{Method} {Path} -> {Status}: {ExceptionType} {SqlError}",
                    context.Request.Method, path, status, ex.GetType().Name, SqlNumber(ex)?.ToString() ?? "");
            }

            context.Response.Clear();
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = status;
            await context.Response.WriteAsync(JsonSerializer.Serialize(new { status, code, field, message },
                new JsonSerializerOptions { DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull }));
        }
    }

    private static (int Status, string Message, string? Code, string? Field) Classify(Exception ex, string method)
    {
        switch (ex)
        {
            case InvalidReferenceException invalid:
                return (400, invalid.Message, "INVALID_REFERENCE", invalid.Field);
            case BusinessConflictException conflict:
                return (409, conflict.Message, conflict.Code ?? "CONFLICT", null);
            case DbUpdateConcurrencyException:
                return HttpMethods.IsDelete(method)
                    ? (404, "This record no longer exists.", "NOT_FOUND", null)
                    : (409, "This record was changed or removed by someone else. Refresh and try again.", "CHANGED", null);
            case BadHttpRequestException { StatusCode: 413 }:
                return (413, "The request is too large.", "TOO_LARGE", null);
            case OverflowException:
                return (400, "A number in the request is out of range.", "OUT_OF_RANGE", null);
        }

        return SqlNumber(ex) switch
        {
            2601 or 2627 => (409, "This record already exists or was just created by someone else. Refresh and try again.", "DUPLICATE", null),
            547 => (409, "A linked record was changed or removed. Refresh and try again.", "REFERENCE_CHANGED", null),
            3960 => (409, "This record was changed by someone else at the same moment. Refresh and try again.", "CHANGED", null),
            1205 or AppLock.TimeoutErrorNumber => (409, "Someone else is saving this right now. Please try again.", "BUSY", null),
            -2 or 596 or 701 or 8645 or 8651 => (503, "The server is busy. Please try again in a moment.", "BUSY", null),
            _ => (500, "An unexpected error occurred. Please try again later.", null, null)
        };
    }

    private void LogUnexpected(Exception ex, string method, string path)
    {
        var key = $"{ex.GetType().FullName}|{SqlNumber(ex)}|{method}|{LogSanitizer.Route(path)}";
        var now = DateTime.UtcNow;
        var logFull = false;
        var suppressed = 0;
        Recent.AddOrUpdate(key,
            _ => { logFull = true; return (now, 0); },
            (_, previous) =>
            {
                if (now - previous.LastFull >= StackTraceEvery)
                {
                    logFull = true;
                    suppressed = previous.Suppressed;
                    return (now, 0);
                }
                return (previous.LastFull, previous.Suppressed + 1);
            });

        if (logFull)
        {
            logger.LogError(ex, "Unhandled exception processing {Method} {Path} ({Suppressed} identical errors in the last minute not repeated)",
                method, path, suppressed);
        }
        else
        {
            logger.LogError("Unhandled {ExceptionType} again on {Method} {Path} (stack trace logged at most once a minute)",
                ex.GetType().Name, method, path);
        }
    }

    private static int? SqlNumber(Exception ex)
    {
        for (var e = ex; e is not null; e = e.InnerException)
        {
            if (e is SqlException sql)
            {
                return sql.Number;
            }
        }
        return null;
    }
}
