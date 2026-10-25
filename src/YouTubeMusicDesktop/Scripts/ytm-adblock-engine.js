/**
 * YouTube Music Native Desktop - 4-Layer Anti-Ad & Premium Experience Engine
 * Zero UI/UX Modification ("Zero AI Slop") — 100% Authentic YouTube Music Web Appearance
 */
(function () {
    'use strict';

    if (window.__ytmNativeAdBlockInitialized) {
        return;
    }
    window.__ytmNativeAdBlockInitialized = true;

    // =========================================================================
    // LAYER 1.5: BACKGROUND PLAY & NON-STOP PLAYBACK ("Masih mendengarkan?" Bypass)
    // =========================================================================
    try {
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            get: function () { return false; }
        });
        Object.defineProperty(document, 'webkitHidden', {
            configurable: true,
            get: function () { return false; }
        });
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: function () { return 'visible'; }
        });

        const origAddEventListener = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function (type, listener, options) {
            if (type === 'visibilitychange' || type === 'webkitvisibilitychange') {
                return;
            }
            return origAddEventListener.call(this, type, listener, options);
        };
    } catch (_) { }

    // Keep YouTube's internal last-activity timer (_lact) constantly fresh
    const refreshActivityTimestamp = () => {
        try {
            window._lact = Date.now();
        } catch (_) { }
    };
    setInterval(refreshActivityTimestamp, 10000);
    refreshActivityTimestamp();

    // =========================================================================
    // LAYER 2: PRE-DOCUMENT JSON PAYLOAD SANITIZER (InnerTube API Interceptor)
    // =========================================================================
    const AD_KEYS_TO_DELETE = new Set([
        'adPlacements',
        'playerAds',
        'adSlots',
        'adBreakHeartbeatParams',
        'adSafetyReason',
        'adPlacementRenderer',
        'mealbarPromoRenderer',
        'statementBannerRenderer',
        'upsellDialogRenderer',
        'backgroundPromoRenderer',
        'featurePromoRenderer',
        'enforcementMessageViewModel',
        'bkaEnforcementMessageViewModel'
    ]);

    function isUpgradeGuideItem(item) {
        if (!item || typeof item !== 'object') return false;
        try {
            const entry = item.guideEntryRenderer || item.pivotBarItemRenderer;
            if (!entry) return false;
            const browseId = entry?.navigationEndpoint?.browseEndpoint?.browseId || '';
            const url = entry?.navigationEndpoint?.urlEndpoint?.url || '';
            const iconType = entry?.icon?.iconType || '';
            if (
                browseId === 'FEmusic_premium' ||
                browseId === 'SPunlimited' ||
                url.includes('music_premium') ||
                iconType === 'YOUTUBE_MUSIC_MONOCHROME' ||
                iconType === 'TAB_MPREMIUM'
            ) {
                return true;
            }
            const formattedTitle =
                entry?.formattedTitle?.runs?.[0]?.text ||
                entry?.title?.runs?.[0]?.text ||
                '';
            if (/^(Upgrade|Get Music Premium|Langganan)$/i.test(formattedTitle.trim())) {
                return true;
            }
        } catch (_) { }
        return false;
    }

    function sanitizeYouTubePayload(obj, visited = new WeakSet(), depth = 0) {
        if (!obj || typeof obj !== 'object' || depth > 18) {
            return obj;
        }
        if (visited.has(obj)) {
            return obj;
        }
        visited.add(obj);

        if (Array.isArray(obj)) {
            for (let i = obj.length - 1; i >= 0; i--) {
                const el = obj[i];
                if (el && typeof el === 'object') {
                    if (
                        isUpgradeGuideItem(el) ||
                        el.adPlacementRenderer ||
                        el.adSlotRenderer ||
                        el.mealbarPromoRenderer ||
                        el.statementBannerRenderer
                    ) {
                        obj.splice(i, 1);
                        continue;
                    }
                    sanitizeYouTubePayload(el, visited, depth + 1);
                }
            }
            return obj;
        }

        for (const key of Object.keys(obj)) {
            if (AD_KEYS_TO_DELETE.has(key)) {
                delete obj[key];
                continue;
            }
            const val = obj[key];
            if (val && typeof val === 'object') {
                sanitizeYouTubePayload(val, visited, depth + 1);
            }
        }

        return obj;
    }

    function shouldSanitizeObject(data) {
        if (!data || typeof data !== 'object') return false;
        return Boolean(
            data.adPlacements ||
            data.playerAds ||
            data.adSlots ||
            data.playabilityStatus ||
            data.streamingData ||
            data.playerResponse ||
            data.responseContext ||
            data.auxiliaryUi ||
            data.contents ||
            data.items
        );
    }

    // Hook JSON.parse (skip tiny strings to avoid unnecessary checks on small config values)
    const origJsonParse = JSON.parse;
    JSON.parse = function (text, reviver) {
        const parsed = origJsonParse.call(this, text, reviver);
        try {
            if (typeof text === 'string' && text.length > 120 && shouldSanitizeObject(parsed)) {
                sanitizeYouTubePayload(parsed);
            }
        } catch (_) { }
        return parsed;
    };

    // Hook Response.prototype.json
    if (window.Response && Response.prototype) {
        const origResponseJson = Response.prototype.json;
        Response.prototype.json = async function () {
            const data = await origResponseJson.call(this);
            try {
                if (shouldSanitizeObject(data)) {
                    sanitizeYouTubePayload(data);
                }
            } catch (_) { }
            return data;
        };
    }

    // Hook global ytInitialPlayerResponse
    let _ytInitialPlayerResponse = window.ytInitialPlayerResponse;
    try {
        Object.defineProperty(window, 'ytInitialPlayerResponse', {
            configurable: true,
            get: function () {
                return _ytInitialPlayerResponse;
            },
            set: function (val) {
                try {
                    if (val && typeof val === 'object') {
                        sanitizeYouTubePayload(val);
                    }
                } catch (_) { }
                _ytInitialPlayerResponse = val;
            }
        });
    } catch (_) { }

    // =========================================================================
    // LAYER 4: SURGICAL COSMETIC FILTER (CSS) - ZERO AI SLOP
    // Only hides ads, promo banners, and the 'Upgrade' sidebar entry.
    // =========================================================================
    const CLEAN_PREMIUM_CSS = `
        html {
            color-scheme: dark !important;
        }

        /* Hide 'Upgrade' navigation item in sidebar and pivot bar */
        ytmusic-guide-entry-renderer:has(a[href*="music_premium"]),
        ytmusic-guide-entry-renderer:has(tp-yt-paper-item[aria-label="Upgrade"]),
        ytmusic-pivot-bar-item-renderer[tab-id="FEmusic_premium"],
        ytmusic-pivot-bar-item-renderer[tab-id="SPunlimited"],
        a[href*="music_premium"] {
            display: none !important;
        }

        /* Hide YouTube Music Premium promotional banners, mealbars & upsell dialogs */
        ytmusic-mealbar-promo-renderer,
        ytmusic-statement-banner-renderer,
        ytmusic-upsell-dialog-renderer,
        ytd-enforcement-message-view-model,
        tp-yt-paper-dialog:has(ytmusic-mealbar-promo-renderer),
        tp-yt-paper-dialog:has(ytmusic-upsell-dialog-renderer),
        tp-yt-paper-dialog:has(ytmusic-you-there-renderer) {
            display: none !important;
        }

        /* Hide video/audio player ad overlays */
        .ytp-ad-overlay-container,
        .ytp-ad-message-container,
        .ytp-ad-player-overlay,
        .ytp-ad-player-overlay-layout,
        .ytp-ad-action-interstitial,
        .ytp-ad-image-overlay,
        .ytp-paid-content-overlay,
        ytmusic-player-bar .advertisement {
            display: none !important;
        }
    `;

    function injectCleanCss() {
        if (document.getElementById('ytm-native-clean-css')) return;
        const target = document.head || document.documentElement;
        if (!target) return;
        const style = document.createElement('style');
        style.id = 'ytm-native-clean-css';
        style.textContent = CLEAN_PREMIUM_CSS;
        target.appendChild(style);
    }

    injectCleanCss();
    document.addEventListener('DOMContentLoaded', injectCleanCss);

    // =========================================================================
    // LAYER 3: REAL-TIME STREAM AD-SKIPPER, MUTE GUARD & IDLE DIALOG BYPASS
    // =========================================================================
    let wasMutedBeforeAd = false;
    let isCurrentlyInAd = false;

    const SKIP_BUTTON_SELECTORS = [
        '.ytp-ad-skip-button',
        '.ytp-ad-skip-button-modern',
        '.ytp-skip-ad-button',
        '.ytp-ad-skip-button-slot button',
        '.ytp-ad-overlay-close-button'
    ].join(', ');

    function handleActiveAdsAndPrompts() {
        injectCleanCss();

        // 1. Remove 'Upgrade' sidebar entry if rendered dynamically without href
        const guideEntries = document.querySelectorAll('ytmusic-guide-entry-renderer');
        for (const entry of guideEntries) {
            const titleEl = entry.querySelector('.title');
            const text = titleEl ? titleEl.textContent.trim() : '';
            if (/^(Upgrade|Music Premium)$/i.test(text)) {
                entry.style.setProperty('display', 'none', 'important');
            }
        }

        // 2. Auto-dismiss "Masih mendengarkan?" / "Video paused. Continue watching?" prompt
        const youThereEl = document.querySelector('ytmusic-you-there-renderer');
        if (youThereEl) {
            const confirmBtn = youThereEl.querySelector('yt-button-renderer button, tp-yt-paper-button, #button');
            if (confirmBtn) {
                confirmBtn.click();
            }
            const dialog = youThereEl.closest('tp-yt-paper-dialog');
            if (dialog && typeof dialog.close === 'function') {
                dialog.close();
            }
        }

        // 3. Check #movie_player for active ad playback
        const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
        const video = document.querySelector('video.html5-main-video, video.video-stream');

        if (!player || !video) return;

        const adShowing =
            player.classList.contains('ad-showing') ||
            player.classList.contains('ad-interrupting') ||
            Boolean(player.querySelector('.ytp-ad-player-overlay, .ytp-ad-player-overlay-layout'));

        if (adShowing) {
            if (!isCurrentlyInAd) {
                isCurrentlyInAd = true;
                wasMutedBeforeAd = video.muted;
            }
            video.muted = true;

            // Click any available skip button immediately
            const skipButtons = document.querySelectorAll(SKIP_BUTTON_SELECTORS);
            for (const btn of skipButtons) {
                try {
                    btn.click();
                } catch (_) { }
            }

            // Fast-forward to the end of the ad stream
            try {
                if (Number.isFinite(video.duration) && video.duration > 0.5) {
                    video.currentTime = Math.max(0, video.duration - 0.05);
                }
                video.playbackRate = 16.0;
            } catch (_) { }

            // Also invoke player's internal skipAd/cancelPlayback if available
            try {
                if (typeof player.skipAd === 'function') {
                    player.skipAd();
                }
            } catch (_) { }
        } else if (isCurrentlyInAd) {
            isCurrentlyInAd = false;
            video.muted = wasMutedBeforeAd;
            try {
                if (video.playbackRate > 2) {
                    video.playbackRate = 1.0;
                }
            } catch (_) { }
        }
    }

    // Observe DOM mutations with requestAnimationFrame throttling
    let mutationScheduled = false;
    const startObserver = () => {
        const root = document.documentElement || document.body;
        if (!root) {
            requestAnimationFrame(startObserver);
            return;
        }
        const observer = new MutationObserver(() => {
            if (mutationScheduled) return;
            mutationScheduled = true;
            requestAnimationFrame(() => {
                mutationScheduled = false;
                handleActiveAdsAndPrompts();
            });
        });
        observer.observe(root, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'src']
        });
    };
    startObserver();
    setInterval(handleActiveAdsAndPrompts, 400);

    // =========================================================================
    // DESKTOP SYSTEM TRAY & DYNAMIC ISLAND CONTROL BRIDGE (No visible UI elements)
    // =========================================================================
    function emitMediaState() {
        try {
            if (!window.chrome || !window.chrome.webview) return;

            const video = document.querySelector('video.html5-main-video, video.video-stream');
            const titleEl = document.querySelector('ytmusic-player-bar .title');
            const artistEl = document.querySelector('ytmusic-player-bar .byline');
            const artEl = document.querySelector('ytmusic-player-bar img.image, ytmusic-player-bar .middle-controls img');

            const title = titleEl ? titleEl.textContent.trim() : '';
            let artist = artistEl ? artistEl.textContent.trim() : '';
            if (artist.includes('•')) {
                artist = artist.split('•')[0].trim();
            }

            let albumArt = artEl && artEl.src ? artEl.src : '';
            if (albumArt.startsWith('data:')) {
                albumArt = '';
            }

            const isPlaying = Boolean(video && !video.paused && !video.ended);
            const currentTime = video && Number.isFinite(video.currentTime) ? video.currentTime : 0;
            const duration = video && Number.isFinite(video.duration) ? video.duration : 0;

            window.chrome.webview.postMessage(JSON.stringify({
                title: title || 'YouTube Music',
                artist: artist || 'Select a song to play',
                albumArt: albumArt,
                isPlaying: isPlaying,
                currentTime: currentTime,
                duration: duration
            }));
        } catch (_) { }
    }

    setInterval(emitMediaState, 500);

    // =========================================================================
    // LAYER 5: STUDIO-GRADE DOLBY SPATIAL AUDIO & MID/SIDE DSP ENGINE
    // True Mid/Side Stereophonic Expander + Transparent Safety Limiter
    // =========================================================================
    let audioCtx = null;
    let connectedVideo = null;
    let dspNodes = null;
    let currentAudioSettings = {
        dolbyEnabled: false,
        dolbyDeviceMode: 'Headphones',
        dolbyPreset: 'Balanced',
        surroundLevel: 70,
        bassLevel: 65,
        clarityLevel: 60
    };

    function ensureDolbyAudioGraph() {
        try {
            const video = document.querySelector('video.html5-main-video, video.video-stream');
            if (!video) return false;

            if (!audioCtx) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) return false;
                audioCtx = new AudioContextClass({ latencyHint: 'interactive' });
            }

            if (audioCtx.state === 'suspended') {
                audioCtx.resume().catch(() => { });
            }

            if (connectedVideo !== video || !dspNodes) {
                const source = audioCtx.createMediaElementSource(video);

                // Dry (Bypass) path
                const dryGain = audioCtx.createGain();
                dryGain.gain.value = 1.0;

                // Wet (Dolby DSP) path
                const wetGain = audioCtx.createGain();
                wetGain.gain.value = 0.0;

                // 1. High-Pass Speaker Protection Filter
                const hpFilter = audioCtx.createBiquadFilter();
                hpFilter.type = 'highpass';
                hpFilter.frequency.value = 22;
                hpFilter.Q.value = 0.707;

                // 2. Sub-Bass Warmth (58 Hz LowShelf)
                const subBassFilter = audioCtx.createBiquadFilter();
                subBassFilter.type = 'lowshelf';
                subBassFilter.frequency.value = 58;
                subBassFilter.gain.value = 0;

                // 3. Upper-Bass Punch (140 Hz Peaking)
                const upperBassFilter = audioCtx.createBiquadFilter();
                upperBassFilter.type = 'peaking';
                upperBassFilter.frequency.value = 140;
                upperBassFilter.Q.value = 1.0;
                upperBassFilter.gain.value = 0;

                // 4. Vocal Presence & Clarity (2800 Hz Peaking)
                const vocalFilter = audioCtx.createBiquadFilter();
                vocalFilter.type = 'peaking';
                vocalFilter.frequency.value = 2800;
                vocalFilter.Q.value = 0.9;
                vocalFilter.gain.value = 0;

                // 5. Studio Air & Sparkle (10500 Hz HighShelf)
                const airFilter = audioCtx.createBiquadFilter();
                airFilter.type = 'highshelf';
                airFilter.frequency.value = 10500;
                airFilter.gain.value = 0;

                // 6. Mid/Side Stereophonic Spatial Matrix
                // Extracts Mid (Center/Vocals) & Side (Stereo Ambiance) cleanly with zero phase cancellation
                const splitter = audioCtx.createChannelSplitter(2);
                const merger = audioCtx.createChannelMerger(2);

                const lToMid = audioCtx.createGain();
                const rToMid = audioCtx.createGain();
                const lToSide = audioCtx.createGain();
                const rToSide = audioCtx.createGain();

                lToMid.gain.value = 0.5;
                rToMid.gain.value = 0.5;
                lToSide.gain.value = 0.5;
                rToSide.gain.value = -0.5; // L - R

                const midGain = audioCtx.createGain();
                const sideGain = audioCtx.createGain();
                midGain.gain.value = 1.0;
                sideGain.gain.value = 1.25;

                const midToL = audioCtx.createGain();
                const midToR = audioCtx.createGain();
                const sideToL = audioCtx.createGain();
                const sideToR = audioCtx.createGain();

                midToL.gain.value = 1.0;
                midToR.gain.value = 1.0;
                sideToL.gain.value = 1.0;
                sideToR.gain.value = -1.0; // Decode back: L = M + S, R = M - S

                // 7. Transparent Safety Peak Limiter (Never squashes normal dynamics)
                const limiter = audioCtx.createDynamicsCompressor();
                limiter.threshold.value = -1.2;
                limiter.knee.value = 3.0;
                limiter.ratio.value = 16.0;
                limiter.attack.value = 0.002;
                limiter.release.value = 0.08;

                // Connect Dry Bypass
                source.connect(dryGain);
                dryGain.connect(audioCtx.destination);

                // Connect Wet Pre-EQ
                source.connect(hpFilter);
                hpFilter.connect(subBassFilter);
                subBassFilter.connect(upperBassFilter);
                upperBassFilter.connect(vocalFilter);
                vocalFilter.connect(airFilter);

                // Feed into Mid/Side Splitter
                airFilter.connect(splitter);

                splitter.connect(lToMid, 0);
                splitter.connect(rToMid, 1);
                splitter.connect(lToSide, 0);
                splitter.connect(rToSide, 1);

                lToMid.connect(midGain);
                rToMid.connect(midGain);
                lToSide.connect(sideGain);
                rToSide.connect(sideGain);

                midGain.connect(midToL);
                midGain.connect(midToR);
                sideGain.connect(sideToL);
                sideGain.connect(sideToR);

                midToL.connect(merger, 0, 0);
                sideToL.connect(merger, 0, 0);

                midToR.connect(merger, 0, 1);
                sideToR.connect(merger, 0, 1);

                merger.connect(limiter);
                limiter.connect(wetGain);
                wetGain.connect(audioCtx.destination);

                connectedVideo = video;
                dspNodes = {
                    dryGain,
                    wetGain,
                    hpFilter,
                    subBassFilter,
                    upperBassFilter,
                    vocalFilter,
                    airFilter,
                    midGain,
                    sideGain,
                    limiter
                };
            }

            return true;
        } catch (_) {
            return false;
        }
    }

    function updateDolbyDspParameters() {
        try {
            const cfg = currentAudioSettings;
            if (!cfg.dolbyEnabled && !dspNodes) {
                return;
            }

            if (!ensureDolbyAudioGraph() || !dspNodes || !audioCtx) {
                return;
            }

            const now = audioCtx.currentTime;
            const tc = 0.035;

            if (!cfg.dolbyEnabled) {
                dspNodes.dryGain.gain.setTargetAtTime(1.0, now, tc);
                dspNodes.wetGain.gain.setTargetAtTime(0.0, now, tc);
                return;
            }

            const isLaptop = cfg.dolbyDeviceMode === 'LaptopSpeakers';
            const preset = cfg.dolbyPreset || 'Balanced';
            const sNorm = Math.max(0, Math.min(100, Number(cfg.surroundLevel) ?? 70)) / 100.0;
            const bNorm = Math.max(0, Math.min(100, Number(cfg.bassLevel) ?? 65)) / 100.0;
            const cNorm = Math.max(0, Math.min(100, Number(cfg.clarityLevel) ?? 60)) / 100.0;

            let presetSubBoost = 1.0;
            let presetPunchBoost = 1.0;
            let presetVocalBoost = 1.0;
            let presetSpatialBoost = 1.0;

            switch (preset) {
                case 'Cinema':
                    presetSpatialBoost = 1.30;
                    presetSubBoost = 1.25;
                    presetVocalBoost = 1.15;
                    break;
                case 'BassBoost':
                    presetSubBoost = 1.45;
                    presetPunchBoost = 1.35;
                    presetSpatialBoost = 0.95;
                    break;
                case 'Vocal':
                    presetVocalBoost = 1.45;
                    presetSubBoost = 0.70;
                    presetPunchBoost = 0.80;
                    presetSpatialBoost = 0.90;
                    break;
                default: // 'Balanced'
                    presetSubBoost = 1.10;
                    presetPunchBoost = 1.10;
                    presetVocalBoost = 1.10;
                    presetSpatialBoost = 1.10;
                    break;
            }

            // 1. High-pass protection (prevents speaker rattle on laptop speakers)
            const hpFreq = isLaptop ? 85 : 22;
            dspNodes.hpFilter.frequency.setTargetAtTime(hpFreq, now, tc);

            // 2. Sub-Bass & Punch
            const subGainDb = isLaptop ? 0.0 : (bNorm * 7.5 * presetSubBoost);
            const punchGainDb = isLaptop
                ? (bNorm * 5.0 * presetPunchBoost)
                : (bNorm * 4.0 * presetPunchBoost);

            dspNodes.subBassFilter.gain.setTargetAtTime(subGainDb, now, tc);
            dspNodes.upperBassFilter.gain.setTargetAtTime(punchGainDb, now, tc);

            // 3. Vocal Presence & Studio Air
            const vocalGainDb = (cNorm * 4.5 * presetVocalBoost) + (isLaptop ? 1.0 : 0.0);
            const airGainDb = cNorm * 4.0;
            dspNodes.vocalFilter.gain.setTargetAtTime(vocalGainDb, now, tc);
            dspNodes.airFilter.gain.setTargetAtTime(airGainDb, now, tc);

            // 4. True Mid/Side Stereo Expander
            // Keeps Center (vocals/kick) 100% solid while opening the Side soundstage wide
            const sideWidth = 0.85 + (sNorm * 0.90 * presetSpatialBoost); // 0.85 to 1.75
            dspNodes.midGain.gain.setTargetAtTime(1.0, now, tc);
            dspNodes.sideGain.gain.setTargetAtTime(sideWidth, now, tc);

            // Activate Wet DSP Chain smoothly
            dspNodes.dryGain.gain.setTargetAtTime(0.0, now, tc);
            dspNodes.wetGain.gain.setTargetAtTime(1.0, now, tc);
        } catch (_) { }
    }
            dspNodes.leftCrossGain.gain.setTargetAtTime(crossAmount, now, tc);
            dspNodes.rightCrossGain.gain.setTargetAtTime(crossAmount, now, tc);

            // 5. Anti-Clipping Compressor & Makeup Leveler
            dspNodes.compressor.threshold.setTargetAtTime(isLaptop ? -17 : -14, now, tc);
            dspNodes.compressor.ratio.setTargetAtTime(isLaptop ? 4.2 : 3.0, now, tc);
            dspNodes.makeupGain.gain.setTargetAtTime(isLaptop ? 1.18 : 1.12, now, tc);

            // Activate Wet DSP Chain smoothly
            dspNodes.dryGain.gain.setTargetAtTime(0.0, now, tc);
            dspNodes.wetGain.gain.setTargetAtTime(1.0, now, tc);
        } catch (_) { }
    }

    // Re-verify audio graph if YouTube Music recreates the <video> element
    setInterval(() => {
        if (currentAudioSettings.dolbyEnabled) {
            const video = document.querySelector('video.html5-main-video, video.video-stream');
            if (video && video !== connectedVideo) {
                updateDolbyDspParameters();
            } else if (audioCtx && audioCtx.state === 'suspended' && video && !video.paused) {
                audioCtx.resume().catch(() => { });
            }
        }
    }, 1500);

    window.__ytmDesktopControl = {
        playPause: function () {
            const btn = document.querySelector('#play-pause-button, ytmusic-player-bar #play-pause-button');
            if (btn) {
                btn.click();
                setTimeout(emitMediaState, 60);
                return;
            }
            const video = document.querySelector('video.html5-main-video');
            if (video) {
                if (video.paused) video.play();
                else video.pause();
                setTimeout(emitMediaState, 60);
            }
        },
        next: function () {
            const btn = document.querySelector('.next-button, ytmusic-player-bar .next-button');
            if (btn) {
                btn.click();
                setTimeout(emitMediaState, 120);
            }
        },
        previous: function () {
            const btn = document.querySelector('.previous-button, ytmusic-player-bar .previous-button');
            if (btn) {
                btn.click();
                setTimeout(emitMediaState, 120);
            }
        },
        seekTo: function (fraction) {
            const video = document.querySelector('video.html5-main-video, video.video-stream');
            if (video && Number.isFinite(video.duration) && video.duration > 0) {
                const clamped = Math.max(0, Math.min(1, Number(fraction) || 0));
                video.currentTime = video.duration * clamped;
                setTimeout(emitMediaState, 50);
            }
        },
        applyAudioSettings: function (settings) {
            if (!settings || typeof settings !== 'object') return;
            currentAudioSettings = Object.assign({}, currentAudioSettings, settings);
            updateDolbyDspParameters();
        }
    };
})();
