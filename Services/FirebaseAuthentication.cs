using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace TruckTracking.Services;
public static class FirebaseAuthentication
{
    public static void Configure(JwtBearerOptions options, string projectId)
    {
        options.Authority = $"https://securetoken.google.com/{projectId}";
        options.Audience = projectId;
        options.MapInboundClaims = false;
        options.IncludeErrorDetails = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true, ValidIssuer = options.Authority,
            ValidateAudience = true, ValidAudience = projectId,
            ValidateLifetime = true, RequireExpirationTime = true,
            RequireSignedTokens = true, ValidateIssuerSigningKey = true,
            ValidAlgorithms = [SecurityAlgorithms.RsaSha256], ClockSkew = TimeSpan.Zero
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                var user = context.Principal!;
                var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                var subject = user.FindFirst("sub")?.Value;
                if (string.IsNullOrWhiteSpace(subject) || subject.Length > 128 ||
                    !long.TryParse(user.FindFirst("iat")?.Value, out var issued) || issued > now ||
                    !long.TryParse(user.FindFirst("auth_time")?.Value, out var authenticated) || authenticated > now ||
                    !string.Equals(user.FindFirst("email_verified")?.Value, "true", StringComparison.OrdinalIgnoreCase) ||
                    string.IsNullOrWhiteSpace(user.FindFirst("email")?.Value))
                    context.Fail("A verified Firebase email is required.");
                return Task.CompletedTask;
            }
        };
    }
}
