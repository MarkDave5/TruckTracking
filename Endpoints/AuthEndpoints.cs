using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using TruckTracking.Services;

namespace TruckTracking.Endpoints;
public static class AuthEndpoints
{
    public sealed record DisplayNameRequest(string? Name);
    public static void MapAuthEndpoints(this WebApplication app)
    {
        // Only public web configuration is returned. No service-account credentials.
        app.MapGet("/api/auth/config", (IConfiguration config) => Results.Ok(new
        {
            apiKey = config["Firebase:apiKey"], authDomain = config["Firebase:authDomain"],
            projectId = config["Firebase:projectId"], appId = config["Firebase:appId"],
            storageBucket = config["Firebase:storageBucket"], messagingSenderId = config["Firebase:messagingSenderId"]
        }));
        app.MapGet("/api/auth/token", (HttpContext context, IAntiforgery antiforgery) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            return Results.Ok(new { token = antiforgery.GetAndStoreTokens(context).RequestToken });
        });
        app.MapPost("/api/auth/session", async (HttpContext context, IAntiforgery antiforgery) =>
        {
            if (!await IsValidRequest(context, antiforgery)) return Results.BadRequest(new { error = "Please refresh the page and try again." });
            var authentication = await context.AuthenticateAsync("Firebase");
            if (!authentication.Succeeded || authentication.Principal is null) return Results.Unauthorized();
            var firebase = authentication.Principal;
            var email = firebase.FindFirstValue("email")!;
            var identity = new ClaimsIdentity([
                new(ClaimTypes.NameIdentifier, firebase.FindFirstValue("sub")!),
                new(ClaimTypes.Name, firebase.FindFirstValue("name") ?? email),
                new(ClaimTypes.Email, email), new("auth_provider", "firebase")
            ], CookieAuthenticationDefaults.AuthenticationScheme);
            // Never extend the browser session beyond the validated Firebase token.
            var expires = DateTimeOffset.FromUnixTimeSeconds(long.Parse(firebase.FindFirstValue("exp")!));
            await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity),
                new AuthenticationProperties { IsPersistent = false, AllowRefresh = false, ExpiresUtc = expires });
            return Results.Ok();
        }).RequireRateLimiting("auth");
        app.MapGet("/api/auth/me", (HttpContext context, AccountDisplayService display) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            var id = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            return string.IsNullOrEmpty(id) ? Results.Unauthorized() : Results.Ok(new { name = display.Get(id) ?? context.User.FindFirstValue(ClaimTypes.Name), email = context.User.FindFirstValue(ClaimTypes.Email) });
        }).RequireAuthorization();
        app.MapPut("/api/account/display-name", async (DisplayNameRequest input, HttpContext context, IAntiforgery antiforgery, AccountDisplayService display) =>
        {
            if (!await IsValidRequest(context, antiforgery)) return Results.BadRequest();
            var id = context.User.FindFirstValue(ClaimTypes.NameIdentifier); if (string.IsNullOrEmpty(id)) return Results.Unauthorized();
            var name = input.Name?.Trim(); if (string.IsNullOrEmpty(name) || name.Length > 80 || name.Any(char.IsControl)) return Results.BadRequest(new { error = "Enter a valid display name (up to 80 characters)." });
            display.Set(id, name); return Results.Ok(new { name });
        }).RequireAuthorization();
        app.MapPost("/api/auth/logout", async (HttpContext context, IAntiforgery antiforgery) =>
        {
            if (!await IsValidRequest(context, antiforgery)) return Results.BadRequest();
            await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.Ok();
        }).RequireAuthorization();
    }
    private static async Task<bool> IsValidRequest(HttpContext context, IAntiforgery antiforgery)
    {
        try { await antiforgery.ValidateRequestAsync(context); return true; }
        catch (AntiforgeryValidationException) { return false; }
    }
}
