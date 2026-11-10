using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using TruckTracking.Services;

namespace TruckTracking.Endpoints;
public static class DetectionEndpoints
{
    public record FrameRequest(string? Image);
    public static void MapDetectionEndpoints(this WebApplication app)
    {
        app.MapPost("/api/detection/frame", async (FrameRequest request, PotholeDetector detector, HttpContext context, IAntiforgery antiforgery, ILogger<PotholeDetector> logger) =>
        {
            try { await antiforgery.ValidateRequestAsync(context); }
            catch (AntiforgeryValidationException) { return Results.BadRequest(); }
            if (string.IsNullOrEmpty(request.Image) || request.Image.Length > 1_000_000 || request.Image.Contains('\n') || request.Image.Contains('\r'))
                return Results.BadRequest(new { error = "Invalid image." });
            try
            {
                var result = await detector.DetectAsync(request.Image, context.RequestAborted);
                return result is null ? Results.StatusCode(429) : Results.Text(result, "application/json");
            }
            catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { return Results.StatusCode(499); }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Pothole detector unavailable");
                return Results.Json(new { error = "Detection is unavailable. Check the local model and training environment." }, statusCode: 503);
            }
        }).RequireAuthorization().WithMetadata(new RequestSizeLimitAttribute(1_100_000));
    }
}
