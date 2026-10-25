using System.Text.Json.Serialization;

namespace YouTubeMusicDesktop.Models;

public sealed class AppSettings
{
    [JsonPropertyName("dolbyEnabled")]
    public bool DolbyEnabled { get; set; } = false;

    [JsonPropertyName("dolbyDeviceMode")]
    public string DolbyDeviceMode { get; set; } = "Headphones";

    [JsonPropertyName("dolbyPreset")]
    public string DolbyPreset { get; set; } = "Music";

    [JsonPropertyName("surroundLevel")]
    public int SurroundLevel { get; set; } = 70;

    [JsonPropertyName("bassLevel")]
    public int BassLevel { get; set; } = 65;

    [JsonPropertyName("clarityLevel")]
    public int ClarityLevel { get; set; } = 60;

    [JsonPropertyName("dynamicIslandEnabled")]
    public bool DynamicIslandEnabled { get; set; } = true;

    public AppSettings Clone() => new()
    {
        DolbyEnabled = DolbyEnabled,
        DolbyDeviceMode = DolbyDeviceMode,
        DolbyPreset = DolbyPreset,
        SurroundLevel = SurroundLevel,
        BassLevel = BassLevel,
        ClarityLevel = ClarityLevel,
        DynamicIslandEnabled = DynamicIslandEnabled
    };
}
