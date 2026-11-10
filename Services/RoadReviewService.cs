using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace TruckTracking.Services;

// Account-scoped manual reviews. These records are not sensor-generated detections.
public sealed class RoadReviewService(IWebHostEnvironment environment)
{
    public sealed record Review(string Id, string TruckId, string TruckPlate, string Driver, string EventTime, string Location, string Notes, string Outcome, string? ClipType, double? Acceleration, double? GyroX, double? GyroY, double? GyroZ, string Source = "Manually added");
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    private readonly object gate = new();
    private string DirectoryFor(string account) => Path.Combine(environment.ContentRootPath, "App_Data", "road-reviews", Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(account))));
    private string RecordPath(string account, string id) => Path.Combine(DirectoryFor(account), id + ".json");
    public Review[] ForAccount(string account)
    {
        lock (gate)
        {
            var dir = DirectoryFor(account);
            if (!Directory.Exists(dir)) return [];
            return Directory.EnumerateFiles(dir, "*.json").Select(path => JsonSerializer.Deserialize<Review>(File.ReadAllText(path), Options) ?? throw new InvalidDataException("Invalid review record."))
                .OrderByDescending(record => record.EventTime).ToArray();
        }
    }
    public Review Save(string account, Review review, byte[]? clip)
    {
        lock (gate)
        {
            var dir = DirectoryFor(account); Directory.CreateDirectory(dir);
            var clipPath = Path.Combine(dir, review.Id + ".clip");
            var recordPath = RecordPath(account, review.Id);
            try
            {
                if (clip is not null) File.WriteAllBytes(clipPath, clip);
                File.WriteAllText(recordPath, JsonSerializer.Serialize(review, Options), Encoding.UTF8);
            }
            catch { if (File.Exists(clipPath)) File.Delete(clipPath); if (File.Exists(recordPath)) File.Delete(recordPath); throw; }
            return review;
        }
    }
    public (string Path, string Type)? Clip(string account, string id)
    {
        if (!Guid.TryParseExact(id, "N", out _)) return null;
        lock (gate)
        {
            var path = RecordPath(account, id);
            if (!File.Exists(path)) return null;
            var review = JsonSerializer.Deserialize<Review>(File.ReadAllText(path), Options);
            var clipPath = Path.Combine(DirectoryFor(account), id + ".clip");
            return review?.ClipType is not null && File.Exists(clipPath) ? (clipPath, review.ClipType) : null;
        }
    }
    public Review? Update(string account, string id, string outcome, string notes)
    {
        if (!Guid.TryParseExact(id, "N", out _)) return null;
        lock (gate)
        {
            var path = RecordPath(account, id);
            if (!File.Exists(path)) return null;
            var existing = JsonSerializer.Deserialize<Review>(File.ReadAllText(path), Options) ?? throw new InvalidDataException("Invalid review record.");
            var updated = existing with { Outcome = outcome, Notes = notes };
            var temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try { File.WriteAllText(temp, JsonSerializer.Serialize(updated, Options), Encoding.UTF8); File.Move(temp, path, true); }
            finally { if (File.Exists(temp)) File.Delete(temp); }
            return updated;
        }
    }
}
