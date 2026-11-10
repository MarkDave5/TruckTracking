using System.Diagnostics;
using System.Text.Json;

namespace TruckTracking.Services;

// One local worker owns the model; frames are processed sequentially and never saved.
public sealed class PotholeDetector(IWebHostEnvironment environment, ILogger<PotholeDetector> logger) : IDisposable
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private Process? worker;

    public async Task<string?> DetectAsync(string frame, CancellationToken requestAborted)
    {
        if (!await gate.WaitAsync(0, requestAborted)) return null;
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(requestAborted);
            timeout.CancelAfter(TimeSpan.FromSeconds(60));
            var process = GetWorker();
            await process.StandardInput.WriteLineAsync(frame.AsMemory(), timeout.Token);
            await process.StandardInput.FlushAsync(timeout.Token);
            var response = await process.StandardOutput.ReadLineAsync(timeout.Token);
            if (response is null) throw new InvalidOperationException("Detector stopped unexpectedly.");
            using var parsed = JsonDocument.Parse(response);
            if (parsed.RootElement.TryGetProperty("error", out _)) throw new InvalidOperationException("Detector rejected frame.");
            return response;
        }
        catch
        {
            StopWorker();
            throw;
        }
        finally { gate.Release(); }
    }

    private Process GetWorker()
    {
        if (worker is { HasExited: false }) return worker;
        StopWorker();
        var root = environment.ContentRootPath;
        var python = Path.Combine(root, ".venv-pothole", "Scripts", "python.exe");
        var script = Path.Combine(root, "training", "detect_worker.py");
        var model = Path.Combine(root, "training", "runs", "pothole", "weights", "best.pt");
        if (!File.Exists(python) || !File.Exists(script) || !File.Exists(model))
            throw new FileNotFoundException("The detector environment or model is unavailable.");
        var info = new ProcessStartInfo(python) { WorkingDirectory = root, UseShellExecute = false,
            RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
            CreateNoWindow = true };
        info.ArgumentList.Add("-u"); info.ArgumentList.Add(script);
        info.Environment["PYTHONUTF8"] = "1";
        worker = new Process { StartInfo = info, EnableRaisingEvents = true };
        worker.ErrorDataReceived += (_, e) => { if (e.Data is not null) logger.LogDebug("Detector: {Message}", e.Data); };
        if (!worker.Start()) throw new InvalidOperationException("Unable to start detector.");
        worker.BeginErrorReadLine();
        return worker;
    }
    private void StopWorker()
    {
        if (worker is null) return;
        try { if (!worker.HasExited) worker.Kill(entireProcessTree: true); }
        catch (InvalidOperationException) { }
        worker.Dispose(); worker = null;
    }
    public void Dispose() { StopWorker(); gate.Dispose(); }
}
