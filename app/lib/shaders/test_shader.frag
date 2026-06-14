#include <flutter/runtime_effect.glsl>

uniform sampler2D u_fft_left;
uniform sampler2D u_fft_right;
uniform sampler2D u_fft_mid;
uniform sampler2D u_fft_side;

uniform float u_time;
uniform float u_width;
uniform float u_height;
uniform float u_bass_left;
uniform float u_bass_right;
uniform float u_energy;
uniform float u_bpm;
uniform float u_beat_phase;
uniform float u_beat_onset;
uniform float u_stereo_width;
uniform float u_zoom;
uniform float u_rotation;
uniform float u_warp_x;
uniform float u_warp_y;
uniform float u_param8;
uniform float u_param9;
uniform float u_param11;

out vec4 fragColor;

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec2 fragCoord = FlutterFragCoord().xy;
    vec2 uv        = fragCoord / vec2(u_width, u_height);
    vec3 col       = vec3(0.02);

    // ── Zone 1: Frequenzbänder (untere 40%) ──
    if (uv.y < 0.4) {
        float local_y = uv.y / 0.4;
        float x       = uv.x;

        // Linker Kanal (grün, linke Hälfte)
        float left  = texture(u_fft_left,  vec2(x * 2.0, 0.5)).r;
        // Rechter Kanal (blau, rechte Hälfte)
        float right = texture(u_fft_right, vec2(x * 2.0 - 1.0, 0.5)).r;

        float bar_width = 1.0 / 32.0;
        float bar_gap   = bar_width * 0.1;

        // Linke Seite: 32 Bänder links
        if (x < 0.5) {
            float band_x  = x * 2.0;
            float band_val = texture(u_fft_left, vec2(band_x, 0.5)).r;

            // Balken
            float in_bar  = step(local_y, band_val);

            // Beat Flash
            float flash = u_beat_onset * 0.3;

            // Farbe: Bass = warm, High = kalt
            float hue = 0.35 - band_x * 0.35;
            vec3 bar_color = hsv2rgb(vec3(hue, 0.8, 0.9 + flash));

            col = mix(col, bar_color * in_bar, in_bar);

            // Hintergrund-Glow
            col += bar_color * 0.05 * band_val;
        }

        // Rechte Seite: 32 Bänder rechts
        if (x >= 0.5) {
            float band_x  = (x - 0.5) * 2.0;
            float band_val = texture(u_fft_right, vec2(band_x, 0.5)).r;

            float in_bar  = step(local_y, band_val);
            float flash   = u_beat_onset * 0.3;
            float hue     = 0.6 + band_x * 0.1;
            vec3 bar_color = hsv2rgb(vec3(hue, 0.8, 0.9 + flash));

            col = mix(col, bar_color * in_bar, in_bar);
            col += bar_color * 0.05 * band_val;
        }

        // Trennlinie Mitte
        if (abs(x - 0.5) < 0.002)
            col = vec3(0.3);
    }

    // ── Zone 2: Stereofeld (mittlere 20%) ──
    if (uv.y >= 0.4 && uv.y < 0.6) {
        float local_y = (uv.y - 0.4) / 0.2;
        float x       = uv.x;

        // Mid (weiß) – zentriert
        float mid  = texture(u_fft_mid,  vec2(x, 0.5)).r;
        // Side (lila) – zeigt Stereobreite
        float side = texture(u_fft_side, vec2(x, 0.5)).r;

        float mid_bar  = step(local_y, mid  * 0.9);
        float side_bar = step(local_y, side * u_stereo_width * 0.9);

        col += vec3(0.8, 0.8, 0.9) * mid_bar  * 0.7;
        col += vec3(0.7, 0.2, 1.0) * side_bar * 0.9;

        // Stereobreite Indikator
        float stereo_x = abs(x - 0.5) * 2.0;
        float stereo_edge = smoothstep(u_stereo_width - 0.02,
                                        u_stereo_width + 0.02,
                                        stereo_x);
        col += vec3(1.0, 0.5, 0.0) * stereo_edge * 0.3;
    }

    // ── Zone 3: Energie + BPM (obere 40%) ──
    if (uv.y >= 0.6) {
        float local_y = (uv.y - 0.6) / 0.4;
        vec2  uvc     = vec2(uv.x * 2.0 - 1.0, local_y * 2.0 - 1.0);

        // Energie-Welle
        float wave = sin(uv.x * 20.0 + u_time * 3.0) * 0.5 + 0.5;
        wave      *= u_energy;
        float in_wave = step(abs(local_y - 0.5), wave * 0.3);

        float hue = u_time * 0.1 + u_energy * 0.3;
        col += hsv2rgb(vec3(hue, 0.8, 0.8)) * in_wave * 0.8;

        // BPM Puls – Kreis der mit Beat pulst
        vec2  center = vec2(0.0, 0.0);
        float radius = 0.2 + (1.0 - u_beat_phase) * 0.1
                     + u_bass_left * 0.05;
        float dist   = length(uvc - center);
        float ring   = smoothstep(radius + 0.01, radius, dist)
                     * smoothstep(radius - 0.02, radius, dist);

        float bpm_norm = clamp((u_bpm - 60.0) / 120.0, 0.0, 1.0);
        vec3  pulse    = mix(vec3(0.2, 0.4, 1.0),
                              vec3(1.0, 0.2, 0.3), bpm_norm);
        col += pulse * ring * (1.5 + u_beat_onset * 2.0);

        // Energie Aura um den Puls
        float aura = exp(-dist * 3.0) * u_energy;
        col += hsv2rgb(vec3(hue + 0.1, 0.7, 1.0)) * aura * 0.4;
    }

    // ── Trennlinien ──
    if (abs(uv.y - 0.4) < 0.002 || abs(uv.y - 0.6) < 0.002)
        col = vec3(0.2);

    // ── Labels ──
    // L (links unten)
    if (uv.x < 0.05 && uv.y < 0.05)
        col = vec3(0.2, 1.0, 0.4) * 0.8;
    // R (rechts unten)
    if (uv.x > 0.95 && uv.y < 0.05)
        col = vec3(0.2, 0.4, 1.0) * 0.8;

    // Beat Flash overlay
    col += u_beat_onset * 0.05;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
