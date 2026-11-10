using System.Security.Claims;
using System.Globalization;
using Microsoft.AspNetCore.Antiforgery;
using TruckTracking.Services;
namespace TruckTracking.Endpoints;
public static class FleetEndpoints
{
    public sealed record TruckRequest(string? Plate, string? Model, double? FuelEfficiencyKmPerLiter, string? TrackerReference);
    public sealed record FuelRequest(string? Driver, double? EfficiencyKmPerLiter, decimal? PricePerLiter);
    public sealed record AssignmentRequest(string? Driver, string? Destination, string? Departure, string? Status, double? Latitude, double? Longitude);
    public sealed record DriverRequest(string? Name);
    public static void MapFleetEndpoints(this WebApplication app)
    {
        app.MapGet("/api/overview", (DemoFleetService fleet, TripFuelService fuel, RegisteredTruckService registered, TripAssignmentService assignments, DriverService drivers, HttpContext context) =>
        {
            var account = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(account)) return Results.Unauthorized();
            var trucks = registered.ForAccount(account);
            var truckIds = trucks.Select(t => t.Id).ToHashSet();
            return Results.Ok(new { demo = true, trucks, drivers = drivers.ForAccount(account), assignments = assignments.ForAccount(account).Where(a => truckIds.Contains(a.TruckId)).ToArray(), events = fleet.Events(), trips = fuel.ForAccount(account, fleet.Trips) });
        }).RequireAuthorization();
        app.MapPost("/api/drivers", async (DriverRequest input, DriverService drivers, HttpContext context, IAntiforgery antiforgery) =>
        {
            try { await antiforgery.ValidateRequestAsync(context); } catch (AntiforgeryValidationException) { return Results.BadRequest(); }
            var account=context.User.FindFirstValue(ClaimTypes.NameIdentifier); if(string.IsNullOrEmpty(account))return Results.Unauthorized();
            var name=input.Name?.Trim(); if(string.IsNullOrEmpty(name)||name.Length>80||name.Any(char.IsControl))return Results.BadRequest(new {error="Enter a valid driver name (up to 80 characters)."});
            try{return Results.Ok(drivers.Add(account,name));}catch(DriverService.DuplicateDriverException){return Results.Conflict(new{error="That driver name is already registered."});}catch(InvalidOperationException ex){return Results.BadRequest(new{error=ex.Message});}
        }).RequireAuthorization();
        app.MapPut("/api/drivers/{id}", async (string id, DriverRequest input, DriverService drivers, HttpContext context, IAntiforgery antiforgery) =>
        {
            try { await antiforgery.ValidateRequestAsync(context); } catch (AntiforgeryValidationException) { return Results.BadRequest(); }
            var account=context.User.FindFirstValue(ClaimTypes.NameIdentifier); if(string.IsNullOrEmpty(account))return Results.Unauthorized();
            var name=input.Name?.Trim(); if(string.IsNullOrEmpty(name)||name.Length>80||name.Any(char.IsControl))return Results.BadRequest(new {error="Enter a valid driver name (up to 80 characters)."});
            try{var result=drivers.Update(account,id,name);return result is null ? Results.NotFound() : Results.Ok(result);}catch(DriverService.DuplicateDriverException){return Results.Conflict(new{error="That driver name is already registered."});}
        }).RequireAuthorization();
        app.MapDelete("/api/drivers/{id}", async (string id, DriverService drivers, HttpContext context, IAntiforgery antiforgery) =>
        {
            try { await antiforgery.ValidateRequestAsync(context); } catch (AntiforgeryValidationException) { return Results.BadRequest(); }
            var account=context.User.FindFirstValue(ClaimTypes.NameIdentifier); if(string.IsNullOrEmpty(account))return Results.Unauthorized();
            return drivers.Remove(account,id) ? Results.NoContent() : Results.NotFound();
        }).RequireAuthorization();
        app.MapPut("/api/trucks/{id}/assignment", async (string id, AssignmentRequest input, RegisteredTruckService registered, TripAssignmentService assignments, HttpContext context, IAntiforgery antiforgery) =>
        {
            try { await antiforgery.ValidateRequestAsync(context); }
            catch (AntiforgeryValidationException) { return Results.BadRequest(); }
            var account = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(account)) return Results.Unauthorized();
            if (!registered.ForAccount(account).Any(t => t.Id == id)) return Results.NotFound();
            var driver = input.Driver?.Trim(); var destination = input.Destination?.Trim();
            if (string.IsNullOrEmpty(driver) || driver.Length > 80 || driver.Any(char.IsControl)
                || string.IsNullOrEmpty(destination) || destination.Length > 160 || destination.Any(char.IsControl)
                || !DateTime.TryParseExact(input.Departure, "yyyy-MM-dd'T'HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)
                || input.Status is not ("Planned" or "In progress" or "Arrived")
                || input.Latitude.HasValue != input.Longitude.HasValue
                || (input.Latitude.HasValue && (!double.IsFinite(input.Latitude.Value) || !double.IsFinite(input.Longitude!.Value) || Math.Abs(input.Latitude.Value) > 90 || Math.Abs(input.Longitude.Value) > 180)))
                return Results.BadRequest(new { error = "Enter a driver, destination, valid departure time and status. Select a valid destination on the map if desired." });
            return Results.Ok(assignments.Save(account, new(id, driver, destination, input.Departure!, input.Status, input.Latitude, input.Longitude)));
        }).RequireAuthorization();
        app.MapPost("/api/trucks", async (TruckRequest input, RegisteredTruckService registered, HttpContext context, IAntiforgery antiforgery) =>
        {
            try { await antiforgery.ValidateRequestAsync(context); }
            catch (AntiforgeryValidationException) { return Results.BadRequest(); }
            var account = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(account)) return Results.Unauthorized();
            var plate = input.Plate?.Trim(); var model = input.Model?.Trim(); var reference = input.TrackerReference?.Trim();
            if (string.IsNullOrEmpty(plate) || plate.Length > 24 || plate.Any(char.IsControl)
                || string.IsNullOrEmpty(model) || model.Length > 80 || model.Any(char.IsControl)
                || input.FuelEfficiencyKmPerLiter is not double efficiency || !double.IsFinite(efficiency) || efficiency < 0.1 || efficiency > 100
                || (reference is not null && (reference.Length > 64 || reference.Any(char.IsControl))))
                return Results.BadRequest(new { error = "Enter a plate number, make and model, and an efficiency from 0.1 to 100 km/L." });
            try { return Results.Ok(registered.Add(account, plate, model, efficiency, string.IsNullOrWhiteSpace(reference) ? null : reference)); }
            catch (RegisteredTruckService.DuplicateTruckException ex) { return Results.Conflict(new { error = ex.Message }); }
            catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }
        }).RequireAuthorization();
        app.MapDelete("/api/trucks/{id}", async (string id, RegisteredTruckService registered, HttpContext context, IAntiforgery antiforgery) =>
        {
            try { await antiforgery.ValidateRequestAsync(context); }
            catch (AntiforgeryValidationException) { return Results.BadRequest(); }
            var account = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(account)) return Results.Unauthorized();
            return registered.Remove(account, id) ? Results.NoContent() : Results.NotFound();
        }).RequireAuthorization();
        app.MapPut("/api/trips/{id}/fuel", async (string id, FuelRequest input, DemoFleetService fleet, TripFuelService fuel, HttpContext context, IAntiforgery antiforgery) =>
        {
            try { await antiforgery.ValidateRequestAsync(context); }
            catch (AntiforgeryValidationException) { return Results.BadRequest(); }
            var account = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(account)) return Results.Unauthorized();
            var trip = fleet.Trips.FirstOrDefault(t => t.Id == id);
            if (trip is null) return Results.NotFound();
            var driver = input.Driver?.Trim();
            if (string.IsNullOrEmpty(driver) || driver.Length > 80 || driver.Any(char.IsControl)
                || input.EfficiencyKmPerLiter is not double efficiency || !double.IsFinite(efficiency) || efficiency < 0.1 || efficiency > 100
                || input.PricePerLiter is not decimal price || price < 0 || price > 10000)
                return Results.BadRequest(new { error = "Enter a driver, efficiency from 0.1 to 100 km/L, and price from 0 to 10,000 per liter." });
            return Results.Ok(fuel.Save(account, trip, new TripFuelService.Assumptions(driver, efficiency, price)));
        }).RequireAuthorization();
        app.MapPatch("/api/events/{id:int}/review", async (int id, DemoFleetService fleet, HttpContext context, IAntiforgery antiforgery) =>
        {
            try { await antiforgery.ValidateRequestAsync(context); }
            catch (AntiforgeryValidationException) { return Results.BadRequest(); }
            return fleet.Review(id) is { } result ? Results.Ok(result) : Results.NotFound();
        }).RequireAuthorization();
    }
}
