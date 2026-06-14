#include <flutter/runtime_effect.glsl>

// ─────────────────────────────────────────
// Uniforms vom Flutter/C++ Core
// ─────────────────────────────────────────

// Auflösung + Zeit
uniform float u_time;
uniform vec2  u_resolution;

// FFT Bänder (32 Bänder pro Kanal)
uniform float u_fft_left[32];
uniform float u_fft_right[32];
uniform float u_fft_mid[32];
uniform float u_fft_side[32];

// Envelopes (ADSR geglättet)
uniform float u_env_left[32];
uniform float u_env_right[32];

// Energie
uniform float u_bass_left;
uniform float u_bass_right;
uniform float u_mid_left;
uniform float u_mid_right;
uniform float u_high_left;
uniform float u_high_right;
uniform float u_energy;

// Beat
uniform float u_bpm;
uniform float u_beat_phase;   // 0.0 - 1.0
uniform float u_beat_onset;   // 0 oder 1

// Stereo
uniform float u_stereo_width;

// DNA / Seed System
uniform float u_zoom;
uniform float u_rotation;
uniform float u_warp_x;
uniform float u_warp_y;
uniform float u_dx;
uniform float u_dy;
uniform float u_params[16];

// Output
out vec4 fragColor;

// ─────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────

// Rotation Matrix
mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

// Smooth HSV zu RGB
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Hash für Seed-basierte Zufälligkeit
float hash(float n) {
    return fract(sin(n) * 43758.5453123);
}

vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)),
             dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453123);
}

// ─────────────────────────────────────────
// Test Shader – 5 Zonen
// ─────────────────────────────────────────
// Zone 1 (oben links):     FFT Bänder L/R visualisiert
// Zone 2 (oben rechts):    Stereo Width + Mid/Side
// Zone 3 (mitte):          DNA/Seed Feedback Loop (Milkdrop-Style)
// Zone 4 (unten links):    Beat Phase + BPM Puls
// Zone 5 (unten rechts):   Energie Gesamtbild
// ─────────────────────────────────────────

void main() {
    vec2 fragCoord = FlutterFragCoord().xy;
    vec2 uv        = fragCoord / u_resolution;
    vec2 uvc       = uv * 2.0 - 1.0;  // -1 bis 1
    uvc.x         *= u_resolution.x / u_resolution.y;

    vec3 col = vec3(0.0);

    // ── Zone 3: DNA Feedback Loop (Mitte, Hintergrund) ──
    {
        vec2 p = uvc;

        // DNA Parameter steuern den Warp
        p += vec2(u_warp_x, u_warp_y) * sin(p.yx * 3.0 + u_time);

        // Rotation aus DNA
        p = rot(u_rotation * u_time * 0.1) * p;

        // Zoom aus DNA (Bass moduliert)
        float zoom = u_zoom + u_bass_left * u_params[11] * 0.5;
        p *= zoom;

        // Feedback-ähnlicher Effekt mit sin/cos
        for (int i = 0; i < 4; i++) {
            float fi = float(i);
            p = abs(p) / dot(p, p) - 0.9
                + u_params[int(fi)] * 0.1;
            p = rot(u_time * 0.05 * (fi + 1.0) * u_params[8]) * p;
        }

        // Farbe aus Energie + Zeit + DNA
        float hue = u_time * u_params[9] * 0.05
                  + u_energy * 0.3
                  + u_beat_phase * 0.1;
        float sat = 0.7 + u_stereo_width * 0.3;
        float val = length(p) * 0.3 + u_energy * 0.4;

        col += hsv2rgb(vec3(hue, sat, val)) * 0.6;
    }

    // ── Zone 1: FFT Bänder (oben, horizontaler Balken) ──
    {
        float bar_height = 0.15;
        float bar_y      = 1.0 - bar_height;

        if (uv.y > bar_y) {
            float local_y = (uv.y - bar_y) / bar_height;
            int   band    = int(uv.x * 32.0);
            band          = clamp(band, 0, 31);

            float left  = u_env_left[band];
            float right = u_env_right[band];

            // Links (grün) / Rechts (blau) überlagert
            float is_left  = step(local_y, left);
            float is_right = step(local_y, right);

            vec3 band_col = vec3(0.0);
            band_col     += vec3(0.2, 1.0, 0.4) * is_left  * 0.8;
            band_col     += vec3(0.2, 0.4, 1.0) * is_right * 0.8;

            // Beat Onset → Flash
            band_col *= 1.0 + u_beat_onset * 0.5;

            col = mix(col, band_col, max(is_left, is_right));
        }
    }

    // ── Zone 2: Stereo Bild (rechts, vertikaler Balken) ──
    {
        float bar_width = 0.06;
        float bar_x     = 1.0 - bar_width;

        if (uv.x > bar_x) {
            float local_x = (uv.x - bar_x) / bar_width;
            int   band    = int(uv.y * 32.0);
            band          = clamp(band, 0, 31);

            float mid  = u_fft_mid[band];
            float side = u_fft_side[band];

            // Mid (weiß) / Side (lila) 
            float is_mid  = step(1.0 - local_x, mid);
            float is_side = step(1.0 - local_x, side * u_stereo_width);

            vec3 stereo_col = vec3(0.0);
            stereo_col += vec3(0.9, 0.9, 0.9) * is_mid  * 0.7;
            stereo_col += vec3(0.8, 0.3, 1.0) * is_side * 0.9;

            col = mix(col, stereo_col, max(is_mid, is_side));
        }
    }

    // ── Zone 4: Beat Puls (unten links, Kreis) ──
    {
        vec2  beat_center = vec2(-0.75, -0.75);
        float beat_pulse  = 1.0 - u_beat_phase;
        float beat_radius = 0.08 + beat_pulse * 0.06
                          + u_bass_left * 0.04;
        float dist        = length(uvc - beat_center);
        float ring        = smoothstep(beat_radius + 0.01, beat_radius, dist)
                          * smoothstep(beat_radius - 0.03, beat_radius, dist);

        // BPM als Farbe (langsam = blau, schnell = rot)
        float bpm_norm = clamp((u_bpm - 60.0) / 140.0, 0.0, 1.0);
        vec3  beat_col = mix(vec3(0.2, 0.4, 1.0),
                              vec3(1.0, 0.2, 0.2), bpm_norm);

        col += beat_col * ring * (1.0 + u_beat_onset * 2.0);
    }

    // ── Zone 5: Energie Aura (unten rechts) ──
    {
        vec2  energy_center = vec2(0.75, -0.75);
        float dist          = length(uvc - energy_center);
        float aura          = exp(-dist * (3.0 - u_energy * 2.0));

        // Hohe Energie → warm, niedrig → kalt
        vec3 energy_col = mix(
            vec3(0.1, 0.3, 0.8),   // kalt / niedrig
            vec3(1.0, 0.5, 0.1),   // warm / hoch
            u_energy
        );

        col += energy_col * aura * 0.5;
    }

    // ── Vignette ──
    {
        float vignette = 1.0 - dot(uvc * 0.4, uvc * 0.4);
        col *= vignette;
    }

    // ── Beat Onset Flash ──
    col += u_beat_onset * 0.08;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
