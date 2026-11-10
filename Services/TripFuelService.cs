using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using TruckTracking.Models;

namespace TruckTracking.Services;

// Per-account overrides for the sample trips. GPS and fleet records are still demo data.
public sealed class TripFuelService(IWebHostEnvironment environment)
{
    private readonly object gate = new();
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    public sealed record Assumptions(string Driver, double EfficiencyKmPerLiter, decimal PricePerLiter);

    public Trip[] ForAccount(string accountId, IEnumerable<Trip> trips)
    {
        lock (gate)
        {
            var saved = Read(accountId);
            return trips.Select(t => saved.TryGetValue(t.Id, out var value)
                ? t with { Driver = value.Driver, EfficiencyKmPerLiter = value.EfficiencyKmPerLiter, PricePerLiter = value.PricePerLiter }
                : t).ToArray();
        }
    }

    public Trip Save(string accountId, Trip trip, Assumptions value)
    {
        lock (gate)
        {
            var saved = Read(accountId);
            saved[trip.Id] = value;
            var path = AccountPath(accountId);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            var temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try
            {
                File.WriteAllText(temp, JsonSerializer.Serialize(saved, JsonOptions), Encoding.UTF8);
                File.Move(temp, path, overwrite: true);
            }
            finally { if (File.Exists(temp)) File.Delete(temp); }
            return trip with { Driver = value.Driver, EfficiencyKmPerLiter = value.EfficiencyKmPerLiter, PricePerLiter = value.PricePerLiter };
        }
    }

    private Dictionary<string, Assumptions> Read(string accountId)
    {
        var path = AccountPath(accountId);
        if (!File.Exists(path)) return new Dictionary<string, Assumptions>(StringComparer.Ordinal);
        return JsonSerializer.Deserialize<Dictionary<string, Assumptions>>(File.ReadAllText(path, Encoding.UTF8), JsonOptions)
            ?? throw new InvalidDataException("Could not read saved trip settings.");
    }
    private string AccountPath(string accountId)
    {
        var key = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(accountId)));
        return Path.Combine(environment.ContentRootPath, "App_Data", "trip-fuel", key + ".json");
    }
}
