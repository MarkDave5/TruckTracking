using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using TruckTracking.Models;

namespace TruckTracking.Services;

// Registration records are private to each signed-in account. References do not pair hardware.
public sealed class RegisteredTruckService(IWebHostEnvironment environment)
{
    private readonly object gate = new();
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    public sealed class DuplicateTruckException(string message) : Exception(message);
    public Truck[] ForAccount(string accountId)
    {
        lock (gate) return Read(accountId).ToArray();
    }
    public Truck Add(string accountId, string plate, string model, double efficiency, string? trackerReference)
    {
        lock (gate)
        {
            var trucks = Read(accountId);
            if (trucks.Any(t => string.Equals(t.Plate, plate, StringComparison.OrdinalIgnoreCase)))
                throw new DuplicateTruckException("This plate number is already registered in your account.");
            if (!string.IsNullOrEmpty(trackerReference) && trucks.Any(t => string.Equals(t.TrackerReference, trackerReference, StringComparison.OrdinalIgnoreCase)))
                throw new DuplicateTruckException("This tracker reference is already recorded in your account.");
            if (trucks.Count >= 200) throw new InvalidOperationException("The account has reached the prototype limit of 200 registered trucks.");
            var truck = new Truck("TRK-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(), model, plate,
                "Not connected", "Location unavailable", 0, "Never", null, null, efficiency, trackerReference, false);
            trucks.Add(truck);
            Write(accountId, trucks);
            return truck;
        }
    }
    public bool Remove(string accountId, string id)
    {
        lock (gate)
        {
            var trucks = Read(accountId);
            if (trucks.RemoveAll(truck => truck.Id == id) == 0) return false;
            Write(accountId, trucks);
            return true;
        }
    }
    private void Write(string accountId, List<Truck> trucks)
    {
        var path = AccountPath(accountId);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try { File.WriteAllText(temp, JsonSerializer.Serialize(trucks, JsonOptions), Encoding.UTF8); File.Move(temp, path, overwrite: true); }
        finally { if (File.Exists(temp)) File.Delete(temp); }
    }
    private List<Truck> Read(string accountId)
    {
        var path = AccountPath(accountId);
        return !File.Exists(path) ? [] : JsonSerializer.Deserialize<List<Truck>>(File.ReadAllText(path, Encoding.UTF8), JsonOptions)
            ?? throw new InvalidDataException("Could not read registered trucks.");
    }
    private string AccountPath(string accountId)
    {
        var key = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(accountId)));
        return Path.Combine(environment.ContentRootPath, "App_Data", "registered-trucks", key + ".json");
    }
}
