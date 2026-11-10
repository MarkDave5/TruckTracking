namespace TruckTracking.Models;
public record Truck(string Id, string Model, string Plate, string Status, string Location, int Speed, string Updated, double? Latitude, double? Longitude, double? FuelEfficiencyKmPerLiter = null, string? TrackerReference = null, bool IsSample = true);
public record RoadEvent(int Id, string Type, string Truck, string Location, string Date, string Time, int Confidence, string Status, double? Latitude, double? Longitude);
public record Trip(string Id, string Truck, string From, string To, string Date, double DistanceKm, string Duration, double EfficiencyKmPerLiter, decimal PricePerLiter, int Detections, string Driver = "");
