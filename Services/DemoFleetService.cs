using TruckTracking.Models;
namespace TruckTracking.Services;

// Replace this service with a persistent database and device ingestion when available.
public sealed class DemoFleetService
{
    private readonly object gate = new();
    public Truck[] Trucks { get; } = [
        new("TRK-001", "Hino 500 Series", "ABC 1234", "On trip", "North Luzon Expressway", 62, "08:42 AM", 14.7500, 120.9860),
        new("TRK-002", "Isuzu F-Series", "DEF 5678", "On trip", "MacArthur Highway", 48, "08:38 AM", 14.7270, 120.9550),
        new("TRK-003", "Fuso Canter", "GHI 9012", "Stopped", "Valenzuela depot", 0, "08:35 AM", 14.7010, 120.9830),
        new("TRK-004", "Hino 300 Series", "JKL 3456", "Offline", "Quezon City", 0, "Yesterday", 14.6760, 121.0437) ];
    private readonly List<RoadEvent> events = [
        new(1042, "Possible pothole", "TRK-001", "North Luzon Expressway", "Nov 08, 2026", "08:42 AM", 91, "Needs review", 14.7450, 120.9900),
        new(1041, "Possible pothole", "TRK-002", "MacArthur Highway", "Nov 08, 2026", "08:26 AM", 84, "Needs review", 14.7230, 120.9530),
        new(1040, "Possible pothole", "TRK-001", "Balintawak interchange", "Nov 08, 2026", "08:12 AM", 78, "Reviewed", 14.6575, 121.0030),
        new(1039, "Possible pothole", "TRK-003", "Valenzuela service road", "Nov 07, 2026", "04:55 PM", 88, "Reviewed", 14.6970, 120.9800) ];
    public Trip[] Trips { get; } = [
        new("TP-2048", "TRK-001", "Valenzuela depot", "San Fernando", "Nov 08, 2026", 68.4, "1h 32m", 6.0, 62.50m, 2),
        new("TP-2047", "TRK-002", "Quezon City", "Malolos", "Nov 08, 2026", 42.8, "1h 08m", 5.5, 62.50m, 1),
        new("TP-2046", "TRK-003", "Caloocan", "Valenzuela depot", "Nov 07, 2026", 18.2, "42m", 6.5, 62.50m, 1),
        new("TP-2045", "TRK-001", "Meycauayan", "Quezon City", "Nov 07, 2026", 27.6, "51m", 6.0, 62.50m, 0) ];
    public RoadEvent[] Events() { lock (gate) return events.ToArray(); }
    public RoadEvent? Review(int id) { lock (gate) { var i = events.FindIndex(e => e.Id == id); if (i < 0) return null; return events[i] = events[i] with { Status = "Reviewed" }; } }
}
