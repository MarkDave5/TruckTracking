using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
namespace TruckTracking.Services;

public sealed class AccountDisplayService(IWebHostEnvironment environment)
{
    private readonly object gate = new();
    private string PathFor(string account) => Path.Combine(environment.ContentRootPath,"App_Data","account-display",Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(account)))+".json");
    public string? Get(string account) { lock(gate) { var path=PathFor(account); return File.Exists(path) ? JsonSerializer.Deserialize<string>(File.ReadAllText(path)) : null; } }
    public void Set(string account,string name) { lock(gate) { var path=PathFor(account);Directory.CreateDirectory(Path.GetDirectoryName(path)!);var temp=path+"."+Guid.NewGuid().ToString("N")+".tmp";try{File.WriteAllText(temp,JsonSerializer.Serialize(name),Encoding.UTF8);File.Move(temp,path,true);}finally{if(File.Exists(temp))File.Delete(temp);} } }
}
