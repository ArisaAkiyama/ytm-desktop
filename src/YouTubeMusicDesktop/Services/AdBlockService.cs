using System.IO;
using System.Reflection;
using Microsoft.Web.WebView2.Core;

namespace YouTubeMusicDesktop.Services;

public sealed class AdBlockService
{
    private static readonly string[] FilterPatterns =
    [
        "*doubleclick.net*",
        "*googlesyndication.com*",
        "*googleadservices.com*",
        "*adservice.google.*",
        "*2mdn.net*",
        "*innovid.com*",
        "*/api/stats/ads*",
        "*/pagead/*",
        "*/ptracking?*",
        "*ad.youtube.com*",
        "*ads.youtube.com*"
    ];

    private static readonly string[] BlockedUrlSubstrings =
    [
        "doubleclick.net",
        "googlesyndication.com",
        "googleadservices.com",
        "adservice.google.",
        "2mdn.net",
        "innovid.com",
        "/api/stats/ads",
        "/pagead/interaction",
        "/pagead/lvz",
        "/pagead/adview",
        "/pagead/conversion",
        "/ptracking?",
        "youtube.com/pagead/",
        "music.youtube.com/pagead/",
        "www.google.com/pagead/",
        "ad.youtube.com",
        "ads.youtube.com",
        "s0.2mdn.net"
    ];

    private string? _cachedEngineScript;

    public async Task AttachAsync(CoreWebView2 webView)
    {
        string script = LoadEmbeddedAdBlockScript();
        if (!string.IsNullOrWhiteSpace(script))
        {
            await webView.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        // Register targeted ad filters instead of universal '*' to eliminate IPC UI thread bottlenecks
        foreach (string filter in FilterPatterns)
        {
            webView.AddWebResourceRequestedFilter(filter, CoreWebView2WebResourceContext.All);
        }

        webView.WebResourceRequested += OnWebResourceRequested;
        webView.DOMContentLoaded += async (_, _) =>
        {
            if (!string.IsNullOrWhiteSpace(script))
            {
                try
                {
                    await webView.ExecuteScriptAsync(script);
                }
                catch
                {
                    // Ignore script execution errors during navigation transitions
                }
            }
        };
    }

    private void OnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        if (sender is not CoreWebView2 webView)
        {
            return;
        }

        string uri = e.Request.Uri;
        if (string.IsNullOrEmpty(uri))
        {
            return;
        }

        if (IsAdRequest(uri))
        {
            e.Response = webView.Environment.CreateWebResourceResponse(
                new MemoryStream(Array.Empty<byte>()),
                204,
                "No Content",
                "Access-Control-Allow-Origin: https://music.youtube.com");
        }
    }

    public static bool IsAdRequest(string uri)
    {
        foreach (string pattern in BlockedUrlSubstrings)
        {
            if (uri.Contains(pattern, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }
        return false;
    }

    private string LoadEmbeddedAdBlockScript()
    {
        if (_cachedEngineScript is not null)
        {
            return _cachedEngineScript;
        }

        Assembly assembly = Assembly.GetExecutingAssembly();
        string? resourceName = assembly
            .GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith("ytm-adblock-engine.js", StringComparison.OrdinalIgnoreCase));

        if (resourceName is null)
        {
            return string.Empty;
        }

        using Stream? stream = assembly.GetManifestResourceStream(resourceName);
        if (stream is null)
        {
            return string.Empty;
        }

        using StreamReader reader = new(stream);
        _cachedEngineScript = reader.ReadToEnd();
        return _cachedEngineScript;
    }
}
