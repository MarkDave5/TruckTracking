using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace TruckTracking.Services;

// One current, owner-entered assignment per truck; this is separate from sample trip history.
public sealed class TripAssignmentService(IWebHostEnvironment environment)
{
    public sealed record Assignment(string TruckId, string Driver, string Destination, string Departure, string Status, double? Latitude, double? Longitude);
    private readonly object gate = new();
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public Assignment[] ForAccount(string accountId)
    {
        lock (gate) return Read(accountId).ToArray();
    }

    public Assignment Save(string accountId, Assignment assignment)
    {
        lock (gate)
        {
            var assignments = Read(accountId);
            assignments.RemoveAll(a => a.TruckId == assignment.TruckId);
            assignments.Add(assignment);
            var path = AccountPath(accountId);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            var temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try { File.WriteAllText(temp, JsonSerializer.Serialize(assignments, JsonOptions), Encoding.UTF8); File.Move(temp, path, overwrite: true); }
            finally { if (File.Exists(temp)) File.Delete(temp); }
            return assignment;
        }
    }

    private List<Assignment> Read(string accountId)
    {
        var path = AccountPath(accountId);
        return !File.Exists(path) ? [] : JsonSerializer.Deserialize<List<Assignment>>(File.ReadAllText(path, Encoding.UTF8), JsonOptions)
            ?? throw new InvalidDataException("Could not read trip assignments.");
    }
    private string AccountPath(string accountId)
    {
        var key = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(accountId)));
        return Path.Combine(environment.ContentRootPath, "App_Data", "trip-assignments", key + ".json");
    }
}
