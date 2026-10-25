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
    // LAYER 5: STUDIO DOLBY SPATIAL AUDIO & DSP ENGINE (Web Audio API)
    // 7-Stage Pipeline: Speaker Protection -> 6-Band Parametric EQ & De-Mud ->
    // Psychoacoustic Sub-Bass Exciter (4x WaveShaper) -> True Mid-Side (M/S) Matrix
    // with Bass-Safe Crossover (160Hz) -> Binaural 3D Convolver (38ms IR) ->
    // Dolby Multi-Knee Leveler -> True-Peak Soft Clipper Limiter.
    // =========================================================================
    let audioCtx = null;
    let connectedVideo = null;
    let dspNodes = null;
    let currentAudioSettings = {
        dolbyEnabled: false,
        dolbyDeviceMode: 'Headphones',
        dolbyPreset: 'Music',
        surroundLevel: 70,
        bassLevel: 65,
        clarityLevel: 60
    };

    // Helper: Generate gentle tanh soft-saturation curve for WaveShaper (anti-clipping limiter & exciter)
    function generateSoftSaturationCurve(samples = 1024, drive = 1.0) {
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; ++i) {
            const x = (i * 2) / samples - 1;
            // Hyperbolic tangent saturation: linear around 0, softly compressing towards +-1.0
            curve[i] = Math.tanh(x * drive);
        }
        return curve;
    }

    // Helper: Generate procedural 38ms stereo impulse response for binaural 3D early reflections
    function generateBinauralEarlyReflectionsBuffer(ctx, duration = 0.038) {
        const sampleRate = ctx.sampleRate;
        const length = Math.floor(sampleRate * duration);
        const buffer = ctx.createBuffer(2, length, sampleRate);
        const leftData = buffer.getChannelData(0);
        const rightData = buffer.getChannelData(1);

        // Defined early reflection tap delays (seconds) and relative gains
        const taps = [
            { t: 0.0042, gL: 0.45, gR: -0.22 },
            { t: 0.0089, gL: -0.32, gR: 0.40 },
            { t: 0.0145, gL: 0.38, gR: 0.35 },
            { t: 0.0210, gL: -0.26, gR: -0.30 },
            { t: 0.0275, gL: 0.22, gR: -0.24 },
            { t: 0.0340, gL: -0.18, gR: 0.20 }
        ];

        // Seed discrete early reflections with decorrelated stereo imaging
        for (const tap of taps) {
            const index = Math.floor(tap.t * sampleRate);
            if (index < length) {
                leftData[index] += tap.gL;
                rightData[index] += tap.gR;
            }
        }

        // Add soft decaying micro-diffuse tail
        const decayTimeConstant = duration * 0.42;
        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;
            const envelope = Math.exp(-t / decayTimeConstant);
            // Low-amplitude decorrelated velvet noise
            leftData[i] += (Math.random() * 2 - 1) * 0.06 * envelope;
            rightData[i] += (Math.random() * 2 - 1) * 0.06 * envelope;
        }

        return buffer;
    }

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

                // --- DRY PATH (Pure Bit-Perfect Bypass) ---
                const dryGain = audioCtx.createGain();
                dryGain.gain.value = 1.0;
                source.connect(dryGain);
                dryGain.connect(audioCtx.destination);

                // --- WET PATH (Studio Dolby Spatial DSP Pipeline) ---
                const wetGain = audioCtx.createGain();
                wetGain.gain.value = 0.0;

                // STAGE 1: Subsonic & Speaker Excursion Protection
                const hpFilter = audioCtx.createBiquadFilter();
                hpFilter.type = 'highpass';
                hpFilter.frequency.value = 22;
                hpFilter.Q.value = 0.707;
                source.connect(hpFilter);

                // STAGE 2: 6-Band Parametric Acoustic EQ
                // Band 1: Deep Sub-Bass (60Hz LowShelf)
                const subBassFilter = audioCtx.createBiquadFilter();
                subBassFilter.type = 'lowshelf';
                subBassFilter.frequency.value = 60;
                subBassFilter.gain.value = 0;

                // Band 2: Upper-Bass Punch & Body (135Hz Peaking)
                const upperBassFilter = audioCtx.createBiquadFilter();
                upperBassFilter.type = 'peaking';
                upperBassFilter.frequency.value = 135;
                upperBassFilter.Q.value = 1.1;
                upperBassFilter.gain.value = 0;

                // Band 3: Low-Mid De-Mudding / Anti-Boxiness Filter (290Hz Peaking)
                // Cuts congested frequencies to create open, studio-grade instrument separation
                const deMudFilter = audioCtx.createBiquadFilter();
                deMudFilter.type = 'peaking';
                deMudFilter.frequency.value = 290;
                deMudFilter.Q.value = 1.35;
                deMudFilter.gain.value = 0;

                // Band 4: Vocal & Dialogue Intelligibility (2500Hz Peaking)
                const vocalFilter = audioCtx.createBiquadFilter();
                vocalFilter.type = 'peaking';
                vocalFilter.frequency.value = 2500;
                vocalFilter.Q.value = 0.9;
                vocalFilter.gain.value = 0;

                // Band 5: Presence & Transient Detail (5600Hz Peaking)
                const presenceFilter = audioCtx.createBiquadFilter();
                presenceFilter.type = 'peaking';
                presenceFilter.frequency.value = 5600;
                presenceFilter.Q.value = 1.0;
                presenceFilter.gain.value = 0;

                // Band 6: Studio Brilliance & Air (11500Hz HighShelf)
                const airFilter = audioCtx.createBiquadFilter();
                airFilter.type = 'highshelf';
                airFilter.frequency.value = 11500;
                airFilter.gain.value = 0;

                // Connect 6-Band EQ chain in series
                hpFilter.connect(subBassFilter);
                subBassFilter.connect(upperBassFilter);
                upperBassFilter.connect(deMudFilter);
                deMudFilter.connect(vocalFilter);
                vocalFilter.connect(presenceFilter);
                presenceFilter.connect(airFilter);

                // STAGE 3: Psychoacoustic Sub-Bass Harmonic Exciter (WaveShaper 4x)
                // Isolates fundamental bass (50-115Hz), generates musical 2nd/3rd harmonics
                // so bass hits hard and clear even on thin laptop speakers without driver excursion!
                const exciterLpf = audioCtx.createBiquadFilter();
                exciterLpf.type = 'lowpass';
                exciterLpf.frequency.value = 115;
                exciterLpf.Q.value = 0.707;

                const exciterShaper = audioCtx.createWaveShaper();
                exciterShaper.curve = generateSoftSaturationCurve(512, 1.8);
                exciterShaper.oversample = '4x';

                const exciterBpf = audioCtx.createBiquadFilter();
                exciterBpf.type = 'bandpass';
                exciterBpf.frequency.value = 160;
                exciterBpf.Q.value = 1.15;

                const exciterGain = audioCtx.createGain();
                exciterGain.gain.value = 0.0;

                hpFilter.connect(exciterLpf);
                exciterLpf.connect(exciterShaper);
                exciterShaper.connect(exciterBpf);
                exciterBpf.connect(exciterGain);

                // Pre-Spatial Summing Bus (EQ output + Psychoacoustic Bass Overtones)
                const preSpatialBus = audioCtx.createGain();
                airFilter.connect(preSpatialBus);
                exciterGain.connect(preSpatialBus);

                // STAGE 4: True Mid-Side (M/S) Matrix with Bass-Safe Crossover
                // ZERO phase cancellation on bass/vocals:
                // Mid = 0.5 * (L + R) [100% solid center, mono-compatible]
                // Side = 0.5 * (L - R) [filtered with HPF 160Hz so bass is never subtracted!]
                const splitter = audioCtx.createChannelSplitter(2);
                preSpatialBus.connect(splitter);

                // Mid encoder: (L * 0.5) + (R * 0.5)
                const midGainL = audioCtx.createGain();
                const midGainR = audioCtx.createGain();
                midGainL.gain.value = 0.5;
                midGainR.gain.value = 0.5;
                splitter.connect(midGainL, 0);
                splitter.connect(midGainR, 1);

                const midBus = audioCtx.createGain();
                midGainL.connect(midBus);
                midGainR.connect(midBus);

                // Side encoder: (L * 0.5) - (R * 0.5)
                const sideGainL = audioCtx.createGain();
                const sideGainR = audioCtx.createGain();
                sideGainL.gain.value = 0.5;
                sideGainR.gain.value = -0.5;
                splitter.connect(sideGainL, 0);
                splitter.connect(sideGainR, 1);

                const sideBusRaw = audioCtx.createGain();
                sideGainL.connect(sideBusRaw);
                sideGainR.connect(sideBusRaw);

                // Bass-Safe High-Pass on Side Channel (prevents sub-bass phase cancellation)
                const sideHpf = audioCtx.createBiquadFilter();
                sideHpf.type = 'highpass';
                sideHpf.frequency.value = 160;
                sideHpf.Q.value = 0.707;
                sideBusRaw.connect(sideHpf);

                // Side Width Multiplier
                const sideWidthGain = audioCtx.createGain();
                sideWidthGain.gain.value = 1.0;
                sideHpf.connect(sideWidthGain);

                // Mid-Side Decoder back to Stereo (L = Mid + Side, R = Mid - Side)
                const merger = audioCtx.createChannelMerger(2);

                const midToL = audioCtx.createGain();
                const midToR = audioCtx.createGain();
                midToL.gain.value = 1.0;
                midToR.gain.value = 1.0;
                midBus.connect(midToL);
                midBus.connect(midToR);

                const sideToL = audioCtx.createGain();
                const sideToR = audioCtx.createGain();
                sideToL.gain.value = 1.0;
                sideToR.gain.value = -1.0;
                sideWidthGain.connect(sideToL);
                sideWidthGain.connect(sideToR);

                midToL.connect(merger, 0, 0);
                sideToL.connect(merger, 0, 0);
                midToR.connect(merger, 0, 1);
                sideToR.connect(merger, 0, 1);

                // STAGE 5: Binaural 3D Early Reflections (ConvolverNode)
                // Adds subtle room dimension and out-of-head acoustic immersion
                const convolver = audioCtx.createConvolver();
                convolver.buffer = generateBinauralEarlyReflectionsBuffer(audioCtx, 0.038);

                const convBpf = audioCtx.createBiquadFilter();
                convBpf.type = 'bandpass';
                convBpf.frequency.value = 2400;
                convBpf.Q.value = 0.55;

                const convWetGain = audioCtx.createGain();
                convWetGain.gain.value = 0.12;

                preSpatialBus.connect(convBpf);
                convBpf.connect(convolver);
                convolver.connect(convWetGain);

                // Post-Spatial Summing Bus (Mid-Side Stereo + Binaural Early Reflections)
                const spatialBus = audioCtx.createGain();
                merger.connect(spatialBus);
                convWetGain.connect(spatialBus);

                // STAGE 6: Dolby Multi-Knee Dynamics Leveler & Compressor
                const compressor = audioCtx.createDynamicsCompressor();
                compressor.threshold.value = -16;
                compressor.knee.value = 18;
                compressor.ratio.value = 3.4;
                compressor.attack.value = 0.003;
                compressor.release.value = 0.18;

                const makeupGain = audioCtx.createGain();
                makeupGain.gain.value = 1.15;

                // STAGE 7: True-Peak Soft Clipper Limiter (0 dBFS Guard)
                // Prevents digital clipping/harsh distortion even at maximum EQ/Spatial levels
                const limiterShaper = audioCtx.createWaveShaper();
                limiterShaper.curve = generateSoftSaturationCurve(1024, 1.05);
                limiterShaper.oversample = '4x';

                spatialBus.connect(compressor);
                compressor.connect(makeupGain);
                makeupGain.connect(limiterShaper);
                limiterShaper.connect(wetGain);
                wetGain.connect(audioCtx.destination);

                connectedVideo = video;
                dspNodes = {
                    dryGain,
                    wetGain,
                    hpFilter,
                    subBassFilter,
                    upperBassFilter,
                    deMudFilter,
                    vocalFilter,
                    presenceFilter,
                    airFilter,
                    exciterGain,
                    sideWidthGain,
                    convWetGain,
                    compressor,
                    makeupGain
                };

                // Bind playback lifecycle hooks directly to the video element
                const onPlayOrResume = () => {
                    if (audioCtx && audioCtx.state === 'suspended') {
                        audioCtx.resume().catch(() => { });
                    }
                    updateDolbyDspParameters();
                };

                video.removeEventListener('play', onPlayOrResume);
                video.removeEventListener('playing', onPlayOrResume);
                video.removeEventListener('loadeddata', onPlayOrResume);
                video.addEventListener('play', onPlayOrResume);
                video.addEventListener('playing', onPlayOrResume);
                video.addEventListener('loadeddata', onPlayOrResume);
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
            const preset = cfg.dolbyPreset || 'Music';
            const sNorm = Math.max(0, Math.min(100, Number(cfg.surroundLevel) ?? 70)) / 100.0;
            const bNorm = Math.max(0, Math.min(100, Number(cfg.bassLevel) ?? 65)) / 100.0;
            const cNorm = Math.max(0, Math.min(100, Number(cfg.clarityLevel) ?? 60)) / 100.0;

            let presetSub = 1.0;
            let presetPunch = 1.0;
            let presetDeMud = 1.0;
            let presetVocal = 1.0;
            let presetPresence = 1.0;
            let presetAir = 1.0;
            let presetWidth = 1.0;
            let presetBinaural = 1.0;

            switch (preset) {
                case 'Cinema':
                    presetWidth = 1.35;
                    presetBinaural = 1.45;
                    presetSub = 1.25;
                    presetPunch = 1.15;
                    presetVocal = 1.25;
                    presetDeMud = 1.2;
                    presetPresence = 1.2;
                    presetAir = 1.15;
                    break;
                case 'BassBoost':
                    presetWidth = 1.05;
                    presetBinaural = 0.85;
                    presetSub = 1.55;
                    presetPunch = 1.40;
                    presetVocal = 0.95;
                    presetDeMud = 0.8;
                    presetPresence = 0.95;
                    presetAir = 0.95;
                    break;
                case 'Vocal':
                    presetWidth = 0.95;
                    presetBinaural = 0.9;
                    presetSub = 0.6;
                    presetPunch = 0.75;
                    presetVocal = 1.6;
                    presetDeMud = 1.4; // Stronger de-mudding for pristine speech
                    presetPresence = 1.35;
                    presetAir = 1.2;
                    break;
                case 'Dynamic':
                    presetWidth = 1.2;
                    presetBinaural = 1.2;
                    presetSub = 1.25;
                    presetPunch = 1.25;
                    presetVocal = 1.2;
                    presetDeMud = 1.15;
                    presetPresence = 1.25;
                    presetAir = 1.25;
                    break;
                default: // 'Music' (Balanced Dolby Audiophile Curve)
                    presetWidth = 1.12;
                    presetBinaural = 1.05;
                    presetSub = 1.15;
                    presetPunch = 1.12;
                    presetVocal = 1.1;
                    presetDeMud = 1.05;
                    presetPresence = 1.1;
                    presetAir = 1.1;
                    break;
            }

            // 1. Subsonic Protection (22Hz on Headphones, 82Hz on Laptop Speakers)
            const hpFreq = isLaptop ? 82 : 22;
            dspNodes.hpFilter.frequency.setTargetAtTime(hpFreq, now, tc);

            // 2. Sub-Bass (60Hz) & Upper-Bass Punch (135Hz)
            const subGainDb = isLaptop ? 0.5 : (bNorm * 7.5 * presetSub);
            const punchGainDb = isLaptop
                ? (bNorm * 5.8 * presetPunch)
                : (bNorm * 4.6 * presetPunch);

            dspNodes.subBassFilter.gain.setTargetAtTime(subGainDb, now, tc);
            dspNodes.upperBassFilter.gain.setTargetAtTime(punchGainDb, now, tc);

            // 3. De-Mud Filter (290Hz cut): Cuts boxiness cleanly by -1.2 to -2.6 dB
            const deMudCutDb = -(1.2 + (cNorm * 1.4 * presetDeMud));
            dspNodes.deMudFilter.gain.setTargetAtTime(deMudCutDb, now, tc);

            // 4. Vocal Presence (2500Hz), Transient Detail (5600Hz) & Studio Air (11500Hz)
            const vocalGainDb = (cNorm * 4.6 * presetVocal) + (isLaptop ? 1.5 : 0.0);
            const presenceGainDb = cNorm * 3.6 * presetPresence;
            const airGainDb = cNorm * 4.2 * presetAir;

            dspNodes.vocalFilter.gain.setTargetAtTime(vocalGainDb, now, tc);
            dspNodes.presenceFilter.gain.setTargetAtTime(presenceGainDb, now, tc);
            dspNodes.airFilter.gain.setTargetAtTime(airGainDb, now, tc);

            // 5. Psychoacoustic Bass Exciter Blend
            // Stronger on Laptop Speakers to compensate for physical lack of sub-bass driver
            const exciterLevel = isLaptop
                ? (0.15 + (bNorm * 0.45))
                : (bNorm * 0.28);
            dspNodes.exciterGain.gain.setTargetAtTime(exciterLevel, now, tc);

            // 6. True Mid-Side Stereo Width (1.0 = standard stereo, up to 2.4 = expansive 3D soundstage)
            const sideWidth = 1.0 + (sNorm * 1.35 * presetWidth);
            dspNodes.sideWidthGain.gain.setTargetAtTime(sideWidth, now, tc);

            // 7. Binaural 3D Early Reflections Reverb Level
            const binauralLevel = isLaptop
                ? (sNorm * 0.12 * presetBinaural)
                : (0.05 + (sNorm * 0.22 * presetBinaural));
            dspNodes.convWetGain.gain.setTargetAtTime(binauralLevel, now, tc);

            // 8. Dynamics Leveler & Limiter
            dspNodes.compressor.threshold.setTargetAtTime(isLaptop ? -18 : -15, now, tc);
            dspNodes.compressor.ratio.setTargetAtTime(isLaptop ? 4.2 : 3.4, now, tc);
            dspNodes.makeupGain.gain.setTargetAtTime(isLaptop ? 1.20 : 1.14, now, tc);

            // Smooth crossfade: Dry -> Wet
            dspNodes.dryGain.gain.setTargetAtTime(0.0, now, tc);
            dspNodes.wetGain.gain.setTargetAtTime(1.0, now, tc);
        } catch (_) { }
    }

    // Window click & user interaction hook to resume AudioContext if autoplay was restricted
    window.addEventListener('click', () => {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => { });
        }
    }, { passive: true });

    // Periodic heartbeat to maintain connection if YouTube Music re-attaches video
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
