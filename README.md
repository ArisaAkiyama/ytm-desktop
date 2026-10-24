# YouTube Music Desktop (Ad-Free + Dynamic Island)

A lightweight, native Windows desktop application for **YouTube Music** built with **C# (.NET 8 WPF)** and **Microsoft Edge WebView2**. It preserves the 100% authentic YouTube Music web interface while adding multi-layer ad blocking and an iPhone-style **Dynamic Island** overlay on the Windows desktop.

---

## ✨ Key Features

- **100% Authentic YouTube Music UI**: Zero custom bloat or intrusive widgets—pure official YouTube Music experience with native Windows dark title bar (`DWMWA_USE_IMMERSIVE_DARK_MODE`).
- **4-Layer Ad-Block Engine**:
  1. **Native Network Blocker**: Blocks ad, tracking, and telemetry endpoints at the `CoreWebView2.WebResourceRequested` level.
  2. **InnerTube JSON Sanitizer**: Strips `adPlacements`, `playerAds`, and promotional overlays before playback starts.
  3. **Stream Guard & Auto-Skip**: Automatically skips unblocked video ad streams and prevents forced pauses (*"Still watching?"* bypass).
  4. **Cosmetic Filter**: Hides *Upgrade* tabs, premium trial banners, and promotional popups.
- **iPhone-Style Dynamic Island (Windows Desktop)**:
  - Appears when the main window is minimized to the system tray and **only on the Windows Desktop ("Show Desktop")** so it never blocks other active applications.
  - Powered by **60/120 FPS VSync Shared-Element Morphing** spring physics (`CompositionTarget.Rendering`).
  - Features live album artwork, scrolling track metadata, animated 5-bar equalizer waveform, interactive seek bar, and media playback controls.
- **Background Playback & System Tray**: Minimize to the Windows System Tray with quick controls and single-instance enforcement.

---

## 🛠️ Project Structure

```text
├── src/YouTubeMusicDesktop/
│   ├── Assets/                  # Official multi-resolution icon (ytm.ico)
│   ├── Interop/                 # Win32 DWM & Z-Order Desktop detection (NativeMethods.cs)
│   ├── Models/                  # Real-time media telemetry model (MediaPlaybackState.cs)
│   ├── Scripts/                 # 4-layer JS ad-blocker & player bridge (ytm-adblock-engine.js)
│   ├── Services/                # Native network filter & System Tray service
│   ├── DynamicIslandWindow.xaml # VSync Shared-Element Morphing Dynamic Island UI
│   └── MainWindow.xaml          # Main WebView2 host window
├── Installer/
│   ├── YouTubeMusic.iss         # Inno Setup 6 installer script (English)
│   ├── build-installer.ps1      # Automated self-contained publish & installer build script
│   └── assets/                  # Wizard branding bitmaps
└── YouTubeMusicDesktop.sln
```

---

## 🚀 Building from Source

### Prerequisites
- [**.NET 8.0 SDK**](https://dotnet.microsoft.com/download/dotnet/8.0) (for building from source)
- [**Inno Setup 6**](https://jrsoftware.org/isdl.php) *(optional, for compiling the Windows Setup `.exe`)*

### Run in Development
```powershell
dotnet run --project src\YouTubeMusicDesktop\YouTubeMusicDesktop.csproj -c Release
```

### Build Universal Windows Installer (`Setup.exe`)
The build script publishes a **self-contained single-file executable** (so target PCs do **not** need .NET 8 installed) and compiles the Inno Setup installer into `dist/YouTubeMusic_Setup_v1.0.0.exe`:

```powershell
powershell -ExecutionPolicy Bypass -File .\Installer\build-installer.ps1
```

---

## 📄 License

This project is for educational and personal desktop use. YouTube Music is a trademark of Google LLC.
