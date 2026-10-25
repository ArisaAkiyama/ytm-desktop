using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using YouTubeMusicDesktop.Models;
using YouTubeMusicDesktop.Services;
using Brush = System.Windows.Media.Brush;
using Brushes = System.Windows.Media.Brushes;
using Button = System.Windows.Controls.Button;
using Color = System.Windows.Media.Color;

namespace YouTubeMusicDesktop;

public partial class SettingsWindow : Window
{
    private static readonly Brush AccentRedBrush = new SolidColorBrush(Color.FromRgb(255, 0, 51));
    private static readonly Brush TrackOffBrush = new SolidColorBrush(Color.FromRgb(39, 39, 48));
    private static readonly Brush TabActiveBgBrush = new SolidColorBrush(Color.FromRgb(39, 39, 51));
    private static readonly Brush TabInactiveTextBrush = new SolidColorBrush(Color.FromRgb(142, 142, 152));
    private static readonly Brush DeviceSelectedBgBrush = new SolidColorBrush(Color.FromRgb(40, 40, 52));
    private static readonly Brush DeviceUnselectedTextBrush = new SolidColorBrush(Color.FromRgb(142, 142, 154));
    private static readonly Brush PresetSelectedBgBrush = new SolidColorBrush(Color.FromRgb(44, 44, 56));
    private static readonly Brush PresetSelectedBorderBrush = new SolidColorBrush(Color.FromRgb(255, 0, 51));
    private static readonly Brush PresetUnselectedBgBrush = new SolidColorBrush(Color.FromRgb(24, 24, 32));
    private static readonly Brush PresetUnselectedBorderBrush = new SolidColorBrush(Color.FromRgb(37, 37, 48));
    private static readonly Brush PresetUnselectedTextBrush = new SolidColorBrush(Color.FromRgb(152, 152, 162));

    private readonly AppSettingsService _settingsService;
    private readonly Action<AppSettings> _onSettingsChanged;
    private bool _isSyncingUi;

    public SettingsWindow(
        AppSettingsService settingsService,
        Action<AppSettings> onSettingsChanged)
    {
        InitializeComponent();
        _settingsService = settingsService;
        _onSettingsChanged = onSettingsChanged;
        SyncUiFromSettings(_settingsService.Current);
    }

    public void SyncUiFromSettings(AppSettings settings)
    {
        _isSyncingUi = true;
        try
        {
            // 1. Dolby Master Toggle
            DolbyToggleTrack.Background = settings.DolbyEnabled ? AccentRedBrush : TrackOffBrush;
            DolbyToggleThumb.HorizontalAlignment = settings.DolbyEnabled
                ? System.Windows.HorizontalAlignment.Right
                : System.Windows.HorizontalAlignment.Left;

            // Dims sub-controls gracefully when Dolby is OFF
            DolbyControlsArea.Opacity = settings.DolbyEnabled ? 1.0 : 0.38;
            DolbyControlsArea.IsEnabled = settings.DolbyEnabled;

            // 2. Output Device Optimization
            bool isLaptop = string.Equals(settings.DolbyDeviceMode, "LaptopSpeakers", StringComparison.OrdinalIgnoreCase);
            CardHeadphones.Background = isLaptop ? Brushes.Transparent : DeviceSelectedBgBrush;
            TxtHeadphones.Foreground = isLaptop ? DeviceUnselectedTextBrush : Brushes.White;
            TxtHeadphones.FontWeight = isLaptop ? FontWeights.Medium : FontWeights.SemiBold;

            CardLaptopSpeakers.Background = isLaptop ? DeviceSelectedBgBrush : Brushes.Transparent;
            TxtLaptopSpeakers.Foreground = isLaptop ? Brushes.White : DeviceUnselectedTextBrush;
            TxtLaptopSpeakers.FontWeight = isLaptop ? FontWeights.SemiBold : FontWeights.Medium;

            // 3. Preset Buttons (Balanced, Cinema, Bass, Vocal)
            UpdatePresetSelection(settings.DolbyPreset);

            // 4. Fine-Tuning Sliders
            SurroundSlider.Value = Math.Clamp(settings.SurroundLevel, 0, 100);
            BassSlider.Value = Math.Clamp(settings.BassLevel, 0, 100);
            ClaritySlider.Value = Math.Clamp(settings.ClarityLevel, 0, 100);
            SurroundValueText.Text = $"{(int)SurroundSlider.Value}%";
            BassValueText.Text = $"{(int)BassSlider.Value}%";
            ClarityValueText.Text = $"{(int)ClaritySlider.Value}%";

            // 5. Dynamic Island Toggle
            IslandToggleTrack.Background = settings.DynamicIslandEnabled ? AccentRedBrush : TrackOffBrush;
            IslandToggleThumb.HorizontalAlignment = settings.DynamicIslandEnabled
                ? System.Windows.HorizontalAlignment.Right
                : System.Windows.HorizontalAlignment.Left;
        }
        finally
        {
            _isSyncingUi = false;
        }
    }

    private void UpdatePresetSelection(string activePreset)
    {
        SetPresetBtnState(PresetBalancedBtn, string.Equals(activePreset, "Balanced", StringComparison.OrdinalIgnoreCase) || string.Equals(activePreset, "Music", StringComparison.OrdinalIgnoreCase) || string.Equals(activePreset, "Dynamic", StringComparison.OrdinalIgnoreCase));
        SetPresetBtnState(PresetCinemaBtn, string.Equals(activePreset, "Cinema", StringComparison.OrdinalIgnoreCase));
        SetPresetBtnState(PresetBassBtn, string.Equals(activePreset, "BassBoost", StringComparison.OrdinalIgnoreCase) || string.Equals(activePreset, "Bass", StringComparison.OrdinalIgnoreCase));
        SetPresetBtnState(PresetVocalBtn, string.Equals(activePreset, "Vocal", StringComparison.OrdinalIgnoreCase));
    }

    private static void SetPresetBtnState(Button btn, bool isSelected)
    {
        btn.Background = isSelected ? PresetSelectedBgBrush : PresetUnselectedBgBrush;
        btn.Foreground = isSelected ? Brushes.White : PresetUnselectedTextBrush;
        btn.BorderBrush = isSelected ? PresetSelectedBorderBrush : PresetUnselectedBorderBrush;
    }

    private void SaveAndNotify(AppSettings updated)
    {
        _settingsService.Save(updated);
        SyncUiFromSettings(updated);
        _onSettingsChanged(updated);
    }

    private void OnTabDolbyClick(object sender, MouseButtonEventArgs e) => SwitchTab(0);
    private void OnTabIslandClick(object sender, MouseButtonEventArgs e) => SwitchTab(1);
    private void OnTabAboutClick(object sender, MouseButtonEventArgs e) => SwitchTab(2);

    private void SwitchTab(int tabIndex)
    {
        PanelDolby.Visibility = tabIndex == 0 ? Visibility.Visible : Visibility.Collapsed;
        PanelIsland.Visibility = tabIndex == 1 ? Visibility.Visible : Visibility.Collapsed;
        PanelAbout.Visibility = tabIndex == 2 ? Visibility.Visible : Visibility.Collapsed;

        TabBtnDolby.Background = tabIndex == 0 ? TabActiveBgBrush : Brushes.Transparent;
        TabTxtDolby.Foreground = tabIndex == 0 ? Brushes.White : TabInactiveTextBrush;
        TabTxtDolby.FontWeight = tabIndex == 0 ? FontWeights.SemiBold : FontWeights.Medium;

        TabBtnIsland.Background = tabIndex == 1 ? TabActiveBgBrush : Brushes.Transparent;
        TabTxtIsland.Foreground = tabIndex == 1 ? Brushes.White : TabInactiveTextBrush;
        TabTxtIsland.FontWeight = tabIndex == 1 ? FontWeights.SemiBold : FontWeights.Medium;

        TabBtnAbout.Background = tabIndex == 2 ? TabActiveBgBrush : Brushes.Transparent;
        TabTxtAbout.Foreground = tabIndex == 2 ? Brushes.White : TabInactiveTextBrush;
        TabTxtAbout.FontWeight = tabIndex == 2 ? FontWeights.SemiBold : FontWeights.Medium;
    }

    private void OnDolbyMasterToggleClick(object sender, MouseButtonEventArgs e)
    {
        AppSettings next = _settingsService.Current.Clone();
        next.DolbyEnabled = !next.DolbyEnabled;
        SaveAndNotify(next);
    }

    private void OnDeviceHeadphonesClick(object sender, MouseButtonEventArgs e)
    {
        AppSettings next = _settingsService.Current.Clone();
        next.DolbyDeviceMode = "Headphones";
        SaveAndNotify(next);
    }

    private void OnDeviceLaptopClick(object sender, MouseButtonEventArgs e)
    {
        AppSettings next = _settingsService.Current.Clone();
        next.DolbyDeviceMode = "LaptopSpeakers";
        SaveAndNotify(next);
    }

    private void ApplyPreset(string presetName, int surround, int bass, int clarity)
    {
        AppSettings next = _settingsService.Current.Clone();
        next.DolbyPreset = presetName;
        next.SurroundLevel = surround;
        next.BassLevel = bass;
        next.ClarityLevel = clarity;
        SaveAndNotify(next);
    }

    private void OnPresetBalancedClick(object sender, RoutedEventArgs e) => ApplyPreset("Balanced", 70, 65, 60);
    private void OnPresetCinemaClick(object sender, RoutedEventArgs e) => ApplyPreset("Cinema", 90, 75, 70);
    private void OnPresetBassClick(object sender, RoutedEventArgs e) => ApplyPreset("BassBoost", 60, 90, 55);
    private void OnPresetVocalClick(object sender, RoutedEventArgs e) => ApplyPreset("Vocal", 50, 40, 85);

    private void OnDspSliderValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
    {
        if (_isSyncingUi || !IsLoaded)
        {
            return;
        }

        int s = (int)Math.Round(SurroundSlider.Value);
        int b = (int)Math.Round(BassSlider.Value);
        int c = (int)Math.Round(ClaritySlider.Value);

        SurroundValueText.Text = $"{s}%";
        BassValueText.Text = $"{b}%";
        ClarityValueText.Text = $"{c}%";

        AppSettings next = _settingsService.Current.Clone();
        next.SurroundLevel = s;
        next.BassLevel = b;
        next.ClarityLevel = c;
        _settingsService.Save(next);
        _onSettingsChanged(next);
    }

    private void OnIslandMasterToggleClick(object sender, MouseButtonEventArgs e)
    {
        AppSettings next = _settingsService.Current.Clone();
        next.DynamicIslandEnabled = !next.DynamicIslandEnabled;
        SaveAndNotify(next);
    }

    private void OnOpenGitHubClick(object sender, RoutedEventArgs e)
    {
        try
        {
            Process.Start(new ProcessStartInfo("https://github.com/ArisaAkiyama/ytm-desktop")
            {
                UseShellExecute = true
            });
        }
        catch
        {
            // Ignore browser launch errors
        }
    }

    private void OnCloseButtonClick(object sender, RoutedEventArgs e)
    {
        Hide();
    }

    private void OnWindowDeactivated(object? sender, EventArgs e)
    {
        Hide();
    }
}
