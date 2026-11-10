using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using TruckTracking.Services;

namespace TruckTracking.Endpoints;

public static class RoadReviewEndpoints
{
    public sealed record ReviewUpdate(string? Outcome, string? Notes);
    private static bool ValidText(string? text, int max, bool required = false) => (!required || !string.IsNullOrWhiteSpace(text)) && (text is null || (text.Length <= max && !text.Any(char.IsControl)));
    private static bool TryNumber(string text, out double? value)
    {
        value = null;
        if (string.IsNullOrWhiteSpace(text)) return true;
        if (!double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var n) || !double.IsFinite(n) || Math.Abs(n) > 10000) return false;
        value = n; return true;
    }
    public static void MapRoadReviewEndpoints(this WebApplication app)
    {
        app.MapGet("/api/road-reviews", (HttpContext context, RoadReviewService reviews) =>
        {
            var account = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            return string.IsNullOrEmpty(account) ? Results.Unauthorized() : Results.Ok(reviews.ForAccount(account));
        }).RequireAuthorization();
        app.MapPost("/api/road-reviews", async (HttpContext context, IAntiforgery antiforgery, RegisteredTruckService trucks, RoadReviewService reviews) =>
        {
            try { await antiforgery.ValidateRequestAsync(context); } catch (AntiforgeryValidationException) { return Results.BadRequest(); }
            var account = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(account)) return Results.Unauthorized();
            if (!context.Request.HasFormContentType || context.Request.ContentLength is null || context.Request.ContentLength > 42_000_000) return Results.BadRequest(new { error = "Video must be under 40 MB." });
            var form = await context.Request.ReadFormAsync();
            var truckId = form["truckId"].ToString(); var truck = trucks.ForAccount(account).FirstOrDefault(t => t.Id == truckId);
            var source = form["source"].ToString();
            var driver = form["driver"].ToString().Trim(); var eventTime = form["eventTime"].ToString(); var location = form["location"].ToString().Trim();
            if (truck is null || source is not ("local-test" or "manual") || !ValidText(driver, 80, true) || !ValidText(location, 160) || !DateTime.TryParseExact(eventTime, "yyyy-MM-dd'T'HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)
                || !TryNumber(form["acceleration"].ToString(), out var accel) || !TryNumber(form["gyroX"].ToString(), out var gx) || !TryNumber(form["gyroY"].ToString(), out var gy) || !TryNumber(form["gyroZ"].ToString(), out var gz))
                return Results.BadRequest(new { error = "Choose a registered truck and enter valid event details and sensor readings." });
            var file = form.Files.GetFile("clip"); byte[]? clip = null; string? type = null;
            if (file is not null && file.Length > 0)
            {
                if (file.Length > 40_000_000) return Results.BadRequest(new { error = "Video must be under 40 MB." });
                using var memory = new MemoryStream(); await file.CopyToAsync(memory); clip = memory.ToArray();
                if (clip.Length >= 4 && clip[0] == 0x1a && clip[1] == 0x45 && clip[2] == 0xdf && clip[3] == 0xa3) type = "video/webm";
                else if (clip.Length >= 12 && clip[4] == (byte)'f' && clip[5] == (byte)'t' && clip[6] == (byte)'y' && clip[7] == (byte)'p') type = "video/mp4";
                else return Results.BadRequest(new { error = "Choose a valid MP4 or WebM video." });
            }
            if (source == "local-test" && clip is null) return Results.BadRequest(new { error = "A local test clip is required." });
            return Results.Ok(reviews.Save(account, new(Guid.NewGuid().ToString("N"), truck.Id, truck.Plate, driver, eventTime, location, "", "Needs review", type, accel, gx, gy, gz, source == "local-test" ? "Local camera test" : "Manually added"), clip));
        }).RequireAuthorization();
        app.MapGet("/api/road-reviews/{id}/clip", (string id, HttpContext context, RoadReviewService reviews) =>
        {
            var account = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(account)) return Results.Unauthorized();
            var clip = reviews.Clip(account, id);
            return clip is null ? Results.NotFound() : Results.File(clip.Value.Path, clip.Value.Type, enableRangeProcessing: true);
        }).RequireAuthorization();
        app.MapPut("/api/road-reviews/{id}", async (string id, ReviewUpdate input, HttpContext context, IAntiforgery antiforgery, RoadReviewService reviews) =>
        {
            try { await antiforgery.ValidateRequestAsync(context); } catch (AntiforgeryValidationException) { return Results.BadRequest(); }
            var account = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(account)) return Results.Unauthorized();
            var notes = input.Notes?.Trim() ?? "";
            if (input.Outcome is not ("Needs review" or "Reviewed" or "Follow-up" or "Insufficient evidence") || !ValidText(notes, 500)) return Results.BadRequest(new { error = "Enter a valid review outcome and note." });
            var result = reviews.Update(account, id, input.Outcome, notes);
            return result is null ? Results.NotFound() : Results.Ok(result);
        }).RequireAuthorization();
    }
}
