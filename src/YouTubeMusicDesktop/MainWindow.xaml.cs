using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Interop;
using Microsoft.Win32;
using Microsoft.Web.WebView2.Core;
using YouTubeMusicDesktop.Interop;
using YouTubeMusicDesktop.Models;
using YouTubeMusicDesktop.Services;
using Application = System.Windows.Application;
using MessageBox = System.Windows.MessageBox;

namespace YouTubeMusicDesktop;

public partial class MainWindow : Window
{
    private const string YouTubeMusicUrl = "https://music.youtube.com";

    private readonly AdBlockService _adBlockService = new();
    private readonly SystemTrayService _systemTrayService;
    private readonly DynamicIslandWindow _dynamicIsland;
    private bool _isExplicitExit;

    public MainWindow()
    {
        InitializeComponent();
        AdaptWindowToMonitorWorkArea();

        _systemTrayService = new SystemTrayService(
            showWindowAction: () => Dispatcher.Invoke(RestoreFromTray),
            executeMediaCommandAsync: ExecutePlayerCommandAsync,
            exitApplicationAction: () => Dispatcher.Invoke(ExitApplication));

        _dynamicIsland = new DynamicIslandWindow(
            restoreMainWindowAction: () => Dispatcher.Invoke(RestoreFromTray),
            executeMediaCommandAsync: ExecutePlayerCommandAsync);

        SourceInitialized += OnSourceInitialized;
        Loaded += OnLoaded;
        StateChanged += OnWindowStateChanged;
        SystemEvents.DisplaySettingsChanged += OnDisplaySettingsChanged;
    }

    /// <summary>
    /// Dynamically calculates window dimensions and position based on the monitor's usable WorkArea
    /// so the window never overflows the screen or hides the titlebar/taskbar.
    /// </summary>
    private void AdaptWindowToMonitorWorkArea()
    {
        Rect workArea = SystemParameters.WorkArea;

        double targetWidth = Math.Round(Math.Clamp(workArea.Width * 0.85, MinWidth, workArea.Width - 20));
        double targetHeight = Math.Round(Math.Clamp(workArea.Height * 0.85, MinHeight, workArea.Height - 20));

        Width = targetWidth;
        Height = targetHeight;

        Left = Math.Max(workArea.Left, workArea.Left + Math.Round((workArea.Width - targetWidth) / 2.0));
        Top = Math.Max(workArea.Top, workArea.Top + Math.Round((workArea.Height - targetHeight) / 2.0));
    }

    private void OnDisplaySettingsChanged(object? sender, EventArgs e)
    {
        Dispatcher.Invoke(() =>
        {
            AdaptWindowToMonitorWorkArea();
            _dynamicIsland.PositionAtTopCenter();
        });
    }

    private void OnSourceInitialized(object? sender, EventArgs e)
    {
        NativeMethods.ApplyDarkTitleBar(this);
    }

    private void OnWindowStateChanged(object? sender, EventArgs e)
    {
        if (WindowState == WindowState.Minimized)
        {
            _dynamicIsland.ShowIsland();
        }
        else
        {
            _dynamicIsland.HideIsland();
        }
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        try
        {
            await InitializeWebViewAsync();
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"Gagal menginisialisasi mesin WebView2:\n{ex.Message}",
                "YouTube Music",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }

    private async Task InitializeWebViewAsync()
    {
        string userDataFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "YouTubeMusicDesktop",
            "UserData");

        Directory.CreateDirectory(userDataFolder);

        string browserArgs = string.Join(" ",
        [
            "--autoplay-policy=no-user-gesture-required",
            "--enable-features=HardwareMediaKeyHandling,MediaSessionService",
            "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding",
            "--disable-backgrounding-occluded-windows",
            "--disable-features=CalculateNativeWinOcclusion,msWebOOUI,msPdfOOUI"
        ]);

        var envOptions = new CoreWebView2EnvironmentOptions(browserArgs)
        {
            Language = "id-ID"
        };
        CoreWebView2Environment environment = await CoreWebView2Environment.CreateAsync(
            browserExecutableFolder: null,
            userDataFolder: userDataFolder,
            options: envOptions);

        await MusicWebView.EnsureCoreWebView2Async(environment);

        CoreWebView2 coreWv = MusicWebView.CoreWebView2;

        // Clean Desktop Chrome User-Agent to ensure seamless Google Account Sign-In & full YTM Web features
        string defaultUa = coreWv.Settings.UserAgent;
        int edgIndex = defaultUa.IndexOf(" Edg/", StringComparison.OrdinalIgnoreCase);
        if (edgIndex > 0)
        {
            coreWv.Settings.UserAgent = defaultUa[..edgIndex];
        }

        coreWv.Settings.AreDefaultContextMenusEnabled = true;
        coreWv.Settings.AreDevToolsEnabled = false;
        coreWv.Settings.IsStatusBarEnabled = false;
        coreWv.Settings.IsZoomControlEnabled = true;
        coreWv.Settings.IsWebMessageEnabled = true;

        coreWv.DocumentTitleChanged += (_, _) =>
        {
            string docTitle = coreWv.DocumentTitle;
            Title = string.IsNullOrWhiteSpace(docTitle) ? "YouTube Music" : docTitle;
            _systemTrayService.UpdateTrackTooltip(docTitle);
        };

        coreWv.WebMessageReceived += OnWebMessageReceived;
        coreWv.NewWindowRequested += OnNewWindowRequested;
        coreWv.PermissionRequested += (_, args) =>
        {
            if (args.PermissionKind == CoreWebView2PermissionKind.Notifications ||
                args.PermissionKind == CoreWebView2PermissionKind.Autoplay)
            {
                args.State = CoreWebView2PermissionState.Allow;
            }
        };

        // Attach 4-Layer AdBlock & Premium Experience Engine BEFORE first navigation
        await _adBlockService.AttachAsync(coreWv);

        coreWv.Navigate(YouTubeMusicUrl);
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            string json = e.TryGetWebMessageAsString();
            if (string.IsNullOrWhiteSpace(json))
            {
                return;
            }

            MediaPlaybackState? state = JsonSerializer.Deserialize<MediaPlaybackState>(json);
            if (state is not null)
            {
                _dynamicIsland.UpdateMediaState(state);
            }
        }
        catch
        {
            // Ignore malformed telemetry messages
        }
    }

    private void OnNewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        e.Handled = true;

        if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out Uri? targetUri))
        {
            return;
        }

        if (IsTrustedInternalHost(targetUri.Host))
        {
            MusicWebView.CoreWebView2?.Navigate(targetUri.AbsoluteUri);
            return;
        }

        if (targetUri.Scheme == Uri.UriSchemeHttps || targetUri.Scheme == Uri.UriSchemeHttp)
        {
            try
            {
                Process.Start(new ProcessStartInfo(targetUri.AbsoluteUri)
                {
                    UseShellExecute = true
                });
            }
            catch
            {
                // Ignore if default browser launch fails
            }
        }
    }

    private static bool IsTrustedInternalHost(string host) =>
        host.Equals("music.youtube.com", StringComparison.OrdinalIgnoreCase) ||
        host.Equals("youtube.com", StringComparison.OrdinalIgnoreCase) ||
        host.EndsWith(".youtube.com", StringComparison.OrdinalIgnoreCase) ||
        host.Equals("accounts.google.com", StringComparison.OrdinalIgnoreCase) ||
        host.Equals("google.com", StringComparison.OrdinalIgnoreCase) ||
        host.EndsWith(".google.com", StringComparison.OrdinalIgnoreCase);

    private async Task ExecutePlayerCommandAsync(string command)
    {
        await Dispatcher.InvokeAsync(async () =>
        {
            if (MusicWebView.CoreWebView2 is null)
            {
                return;
            }

            string invocation = command.Contains('(') ? command : $"{command}()";
            try
            {
                await MusicWebView.CoreWebView2.ExecuteScriptAsync(
                    $"window.__ytmDesktopControl && window.__ytmDesktopControl.{invocation};");
            }
            catch
            {
                // Ignore transient JS errors
            }
        });
    }

    public void RestoreFromTray()
    {
        _dynamicIsland.HideIsland();

        ShowInTaskbar = true;
        Show();
        if (WindowState == WindowState.Minimized)
        {
            WindowState = WindowState.Maximized;
        }

        Activate();
        IntPtr hwnd = new WindowInteropHelper(this).Handle;
        if (hwnd != IntPtr.Zero)
        {
            NativeMethods.ShowWindow(hwnd, NativeMethods.SW_RESTORE);
            NativeMethods.SetForegroundWindow(hwnd);
        }
        MusicWebView.Focus();
    }

    public void AllowSessionEndingClose()
    {
        _isExplicitExit = true;
        _dynamicIsland.Close();
        _systemTrayService.Dispose();
    }

    private void ExitApplication()
    {
        _isExplicitExit = true;
        _dynamicIsland.Close();
        _systemTrayService.Dispose();
        Close();
        Application.Current.Shutdown();
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        if (!_isExplicitExit)
        {
            // Keep music playing in background via System Tray & show Dynamic Island when user clicks 'X'
            e.Cancel = true;
            Hide();
            ShowInTaskbar = false;
            _dynamicIsland.ShowIsland();
            return;
        }

        SystemEvents.DisplaySettingsChanged -= OnDisplaySettingsChanged;
        _dynamicIsland.Close();
        _systemTrayService.Dispose();
        base.OnClosing(e);
    }
}
