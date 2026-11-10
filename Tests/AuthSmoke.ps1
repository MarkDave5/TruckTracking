$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
$testRoot = Join-Path $repoPath '.auth-test'
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $repoPath 'appsettings.json') -Destination $testRoot
$dllPath = Join-Path $repoPath 'bin\Debug\net10.0\TruckTracking.dll'
$testUrl = 'http://127.0.0.1:5099'
$server = Start-Process -FilePath 'dotnet' -ArgumentList @(('"' + $dllPath + '"'), '--contentRoot', ('"' + $testRoot + '"'), '--urls', $testUrl) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $testRoot 'server.log') -RedirectStandardError (Join-Path $testRoot 'error.log')
function Request($path, $method = 'GET', $headers = @{}) {
    Invoke-WebRequest -Uri "$testUrl$path" -Method $method -WebSession $script:session -Headers $headers -SkipHttpErrorCheck
}
function Expect($response, $status, $name) {
    if ($response.StatusCode -ne $status) { throw "$name failed with status $($response.StatusCode)" }
    Write-Output "PASS: $name"
}
try {
    $script:session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
    for ($i = 0; $i -lt 30; $i++) { try { $ready = Request '/api/auth/token'; break } catch { Start-Sleep -Milliseconds 200 } }
    $token = ($ready.Content | ConvertFrom-Json).token
    Expect (Request '/api/overview') 401 'Anonymous fleet API rejected'
    Expect (Request '/api/auth/me') 401 'Anonymous profile rejected'
    Expect (Request '/api/auth/config') 200 'Public Firebase configuration available'
    Expect (Request '/api/auth/session' 'POST') 400 'Session exchange requires CSRF token'
    Expect (Request '/api/auth/session' 'POST' @{ 'X-CSRF-TOKEN'=$token }) 401 'Session exchange requires Firebase token'
    Expect (Request '/api/auth/session' 'POST' @{ 'X-CSRF-TOKEN'=$token; Authorization='Bearer invalid-token' }) 401 'Invalid token rejected'
    Expect (Request '/api/auth/login' 'POST') 404 'Local password login removed'
    Expect (Request '/api/auth/register' 'POST') 404 'Local registration removed'
    Expect (Request '/api/overview') 401 'Failed exchange grants no fleet access'
    Write-Output 'Live verified Firebase sign-in must be tested with a user-controlled account.'
} finally {
    if (!$server.HasExited) { Stop-Process -Id $server.Id }
}
