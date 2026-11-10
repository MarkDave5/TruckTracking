# RoadWatch truck monitoring prototype

ASP.NET Core (.NET 10), HTML, CSS and JavaScript for truck tracking and possible pothole review.

## Run in Visual Studio Community

Open `TruckTracking.sln` with the ASP.NET and web development workload and .NET 10 support installed. Restore NuGet packages, then press F5. Alternatively run `dotnet run --urls http://127.0.0.1:5098`.

The public Firebase web configuration is in `appsettings.json`. It is served to the Firebase browser SDK by `/api/auth/config`. No private service-account credentials or Analytics SDK are used.

## Firebase console setup

Project: `trucktracking-e4f5d`.

1. Open Authentication and select Get started if prompted.
2. In Sign-in method, enable Email/Password (password-based sign-in).
3. Enable Google, select the project's support email, and save.
4. Under Settings > Authorized domains, add the local development hostname used by the browser: `127.0.0.1` for the current preview, or `localhost` if using that hostname. Do not enter a scheme or port. Add the actual production hostname before deployment.
5. Under Templates, review Email address verification and Password reset. The app uses Firebase's hosted action handler for both email links.
6. For a user-controlled live test, register using your own email, open the verification link, and select “I verified my email” in RoadWatch. Then test logout, Google sign-in and Forgot password using your own account.

Official guides:
- https://firebase.google.com/docs/auth/web/password-auth
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/auth/web/manage-users
- https://firebase.google.com/docs/auth/admin/verify-id-tokens

## Authentication flow

Firebase handles email/password registration, Google sign-in, verification emails and password reset. RoadWatch no longer accepts local passwords or reads the old local account store. Existing local-only accounts must register with Firebase; no accounts were migrated or deleted.

The client keeps Firebase tokens in memory, obtains a fresh ID token, and exchanges it for a C# HttpOnly SameSite Strict session cookie. The backend validates Google's signature, RS256 algorithm, project audience, issuer, expiry, subject, issue/authentication times and verified email. Session exchange and logout require an antiforgery token. Exchange attempts are rate limited. Sessions expire with the Firebase ID token (typically within one hour), do not slide, and require a fresh sign-in afterward. Browser refresh during unverified registration requires signing in again to resume verification.

Firebase revocation or account disabling does not immediately invalidate an already issued local cookie; it lasts until logout or token expiry. Before production, implement revocation-aware sessions, HTTPS, protected data-protection keys and per-fleet authorization. All registered accounts currently share the same sample trips and road events. The ignored `App_Data/keys` directory contains cookie-protection keys and must be protected and backed up.

## Features and limitations

Navigation is grouped into Operations (overview, fleet tracking, trips and fuel), Road and Safety (camera, road conditions, safety alerts), and System (offline synchronization, devices and power, reports).

Sample fleet and road records are in memory; review changes reset when the server restarts. The overview uses an interactive OpenStreetMap basemap via Leaflet. Vehicle and event coordinates are approximate sample positions, not live GPS; internet access is needed for map tiles and Leaflet. Camera monitoring lists registered trucks with unconnected camera cards; choosing a card shows its connection status. It also provides a separate user-initiated browser camera preview and stops it when leaving the page. The local trained pothole model analyzes sampled preview frames and displays possible detections; frames and detections are not recorded. GPS, truck camera streams, sensor data, alerts, power measurements, offline device synchronization and permanent fleet storage are not connected. The model runs using the project `.venv-pothole` environment and `training/runs/pothole/weights/best.pt`; keep both available on the server. Detection needs a server restart after code changes. The initial test used images from one dataset and is not proof of field performance. All registered accounts still share this demo; owner-only authorization is not implemented.

Trip reports calculate estimated liters from distance divided by the configured trip-average efficiency and estimated cost using the saved price. In Trip history, open a sample trip to enter a driver, efficiency, and price. These per-trip assumptions are saved per signed-in account under `App_Data/trip-fuel` and survive server restarts; source trips, distances and events remain sample data. Account isolation for settings does not enforce an owner role or secure a real fleet. Use an average rate that reflects typical traffic; no separate idle fuel is added. The estimates do not measure actual consumption, engine state or fuel theft. CSV downloads explicitly label the records as sample data.

## File organization

- `wwwroot/login.html`, `register.html`, `forgot-password.html`: authentication screens.
- `wwwroot/js/firebase-client.js`: Firebase SDK initialization.
- `wwwroot/js/auth.js`: registration, verification, Google sign-in and reset flow.
- `wwwroot/js/account.js`: dashboard profile and logout.
- `Services/FirebaseAuthentication.cs`: Firebase token-validation configuration.
- `Endpoints/AuthEndpoints.cs`: public configuration, CSRF, token-to-session exchange and logout.
- `wwwroot/pages/`: separate dashboard feature pages.
- `wwwroot/css/` and `wwwroot/js/`: shared and feature-specific presentation and behavior.
- `Models/`, `Services/`, `Endpoints/`: C# data models, sample fleet and API routes.

## Verification

`Tests/AuthSmoke.ps1` runs a separate local server on port 5099. It checks anonymous API denial, CSRF enforcement, missing/invalid Firebase token rejection, and removal of local password endpoints. It creates no Firebase account and sends no email. It writes only into ignored `.auth-test/` and stops its test server.

Successful Google sign-in and email delivery require enabled Firebase providers and a user-controlled live account. The smoke tests do not claim these flows have been completed.

## Truck registration

Signed-in accounts can register truck plates, makes and models, typical fuel efficiency, and an optional tracker reference. Registrations are stored per account under `App_Data/registered-trucks` and survive restarts. The tracker reference is not hardware pairing or proof of ownership; new trucks show no live location. Live device authentication, GPS ingestion, and an owner-only role are not implemented. The truck list contains only registered trucks; sample trips and road events remain for demonstration. Truck fuel settings are stored for future trip use and do not change existing trip snapshots.

## Drivers and account settings

Signed-in accounts can add, edit, and remove driver names in Drivers. Records are stored per account under `App_Data/drivers`. Drivers can be selected when assigning a trip, adding a road review, or using the local camera test. Assignments and event records save the driver name as a snapshot, not a persistent driver ID: renaming or removing a directory entry does not rewrite earlier records, and old assignment names remain selectable as previous records. A trip assignment is owner-entered and is not evidence of a live trip.

Settings saves the application's display name per account under `App_Data/account-display`; it does not modify the Firebase profile or sign-in email. Password changes use the existing Firebase password-reset email flow. Google sign-in users manage their password with Google. No email address change flow is implemented.

## Trip assignments

The overview lets the signed-in account save one current assignment per registered truck, including a driver, destination, local departure time, manually selected status, and optional map point chosen by clicking the map. Assignments are account-scoped under `App_Data/trip-assignments`; saving again replaces that truck's current assignment. They are not integrated with the sample trip history or fuel estimates. A destination marker is a planned point, not a live location, route, automatic arrival, or navigation service.

The overview map and the trip destination field provide place suggestions after typing at least three characters, using the Photon demo service by komoot and OpenStreetMap data. Searches are delayed while typing to reduce requests. Search terms are sent to that provider, which may rate-limit requests or be unavailable; the search is intended for prototype-scale use. Users must verify the selected result. For production, use a geocoding provider appropriate for the application's traffic and privacy needs.

The overview also offers an optional Google Maps view and traffic overlay under Map & traffic settings. The user must enter a browser API key with Maps JavaScript API enabled and billing configured. The key is kept only for the current browser page session, is exposed to the browser, and should be restricted to the allowed website origins and API. No Google Maps request occurs until the user chooses it. Switching back to OpenStreetMap disables the traffic layer. Google Maps usage can be billable beyond free allowances; quotas and billing alerts are configured by the account owner in Google Cloud. Google traffic and map coverage vary, and neither provides truck positions without connected GPS. Place suggestions still use Photon.

## Road event review and local recording

An account can add a road event for one of its registered trucks, attach an MP4/WebM clip (up to 40 MB), manually enter measured acceleration and gyroscope values, and save an owner review outcome and note. The local browser camera test can record a user-started clip of up to 20 seconds; it remains in browser memory until explicitly attached to an event and disappears after reload. Recorded or uploaded videos and event records are stored per account under `App_Data/road-reviews` and playback requires the same authenticated account.

Automatic capture can also be explicitly enabled for the local camera test after selecting a truck and supplying a test driver. Recording starts after a non-stale detection, continues for about 10 seconds, and saves the event as a local camera test. Footage before detection is not included; stopping, switching camera, leaving the page, an outage or upload failure can interrupt capture. There is a pause after each saved event and repeated detections may be missed. Boxes are not drawn on the saved clip. No truck-side automatic event capture, truck camera, GPS, accelerometer, gyroscope, sensor synchronization or hardware authentication is connected. Values shown in manually created events are user-supplied and not verified measurements. Sample detections remain separately labeled. The local file store has no retention policy or deletion interface; configure secure backups, access control, storage capacity and an appropriate retention/deletion policy before operational use.
