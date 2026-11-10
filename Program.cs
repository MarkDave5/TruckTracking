using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using TruckTracking.Endpoints;
using TruckTracking.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<DemoFleetService>();
builder.Services.AddSingleton<TripFuelService>();
builder.Services.AddSingleton<RegisteredTruckService>();
builder.Services.AddSingleton<DriverService>();
builder.Services.AddSingleton<AccountDisplayService>();
builder.Services.AddSingleton<TripAssignmentService>();
builder.Services.AddSingleton<RoadReviewService>();
builder.Services.AddSingleton<PotholeDetector>();
var firebaseProjectId = builder.Configuration["Firebase:projectId"] ?? throw new InvalidOperationException("Firebase project ID is required.");
builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(builder.Environment.ContentRootPath, "App_Data", "keys")));
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
{
    options.Cookie.Name = "RoadWatch.FirebaseSession";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    options.ExpireTimeSpan = TimeSpan.FromHours(1);
    options.SlidingExpiration = false;
    options.LoginPath = "/login.html";
    options.Events.OnRedirectToLogin = context =>
    {
        if (context.Request.Path.StartsWithSegments("/api")) context.Response.StatusCode = 401;
        else context.Response.Redirect("/login.html");
        return Task.CompletedTask;
    };
}).AddJwtBearer("Firebase", options => FirebaseAuthentication.Configure(options, firebaseProjectId));
builder.Services.AddAuthorization();
builder.Services.AddAntiforgery(options => options.HeaderName = "X-CSRF-TOKEN");
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "SAMEORIGIN";
    var path = context.Request.Path;
    var publicPath = path == "/login.html" || path == "/register.html" || path == "/forgot-password.html" || path.StartsWithSegments("/css") || path.StartsWithSegments("/js") || path.StartsWithSegments("/api/auth");
    if (!publicPath && context.User.Identity?.IsAuthenticated != true)
    {
        context.Response.Headers.CacheControl = "no-store";
        if (path.StartsWithSegments("/api")) context.Response.StatusCode = 401;
        else context.Response.Redirect("/login.html");
        return;
    }
    if (context.User.Identity?.IsAuthenticated == true) context.Response.Headers.CacheControl = "no-store";
    await next();
});
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapAuthEndpoints();
app.MapFleetEndpoints();
app.MapRoadReviewEndpoints();
app.MapDetectionEndpoints();
app.Run();
