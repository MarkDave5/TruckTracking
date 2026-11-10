using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace TruckTracking.Services;

public sealed class DriverService(IWebHostEnvironment environment)
{
    public sealed record Driver(string Id, string Name);
    public sealed class DuplicateDriverException : Exception;
    private readonly object gate = new();
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    private string PathFor(string account) => Path.Combine(environment.ContentRootPath, "App_Data", "drivers", Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(account))) + ".json");
    private List<Driver> Read(string account) { var path=PathFor(account); return !File.Exists(path) ? [] : JsonSerializer.Deserialize<List<Driver>>(File.ReadAllText(path),Options) ?? throw new InvalidDataException("Invalid driver records."); }
    private void Write(string account, List<Driver> drivers)
    {
        var path=PathFor(account); Directory.CreateDirectory(Path.GetDirectoryName(path)!); var temp=path+"."+Guid.NewGuid().ToString("N")+".tmp";
        try { File.WriteAllText(temp,JsonSerializer.Serialize(drivers,Options),Encoding.UTF8); File.Move(temp,path,true); }
        finally { if (File.Exists(temp)) File.Delete(temp); }
    }
    public Driver[] ForAccount(string account) { lock(gate) return Read(account).OrderBy(d => d.Name, StringComparer.OrdinalIgnoreCase).ToArray(); }
    public Driver Add(string account, string name)
    {
        lock(gate) { var drivers=Read(account); if(drivers.Any(d=>string.Equals(d.Name,name,StringComparison.OrdinalIgnoreCase))) throw new DuplicateDriverException(); if(drivers.Count>=200) throw new InvalidOperationException("Maximum of 200 drivers reached."); var driver=new Driver(Guid.NewGuid().ToString("N"),name); drivers.Add(driver); Write(account,drivers); return driver; }
    }
    public Driver? Update(string account,string id,string name)
    {
        lock(gate) { var drivers=Read(account); var index=drivers.FindIndex(d=>d.Id==id); if(index<0)return null; if(drivers.Any(d=>d.Id!=id && string.Equals(d.Name,name,StringComparison.OrdinalIgnoreCase)))throw new DuplicateDriverException(); var updated=drivers[index] with{Name=name}; drivers[index]=updated; Write(account,drivers); return updated; }
    }
    public bool Remove(string account,string id) { lock(gate) { var drivers=Read(account); if(drivers.RemoveAll(d=>d.Id==id)==0)return false; Write(account,drivers); return true; } }
}
