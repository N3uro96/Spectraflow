#include <flutter/runtime_effect.glsl>

// ─────────────────────────────────────────
// FFT Daten als Texturen (SkSL kompatibel)
// 32x1 Pixel: jeder Pixel = ein FFT Band
// ─────────────────────────────────────────
uniform sampler2D u_fft_left;
uniform sampler2D u_fft_right;
uniform sampler2D u_fft_mid;
uniform sampler2D u_fft_side;

// Skalare Uniforms
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
uniform float u_param0;
uniform float u_param1;
uniform float u_param2;
uniform float u_param8;
uniform float u_param9;
uniform float u_param11;

out vec4 fragColor;

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// FFT Band sampeln via Textur (x = 0.0-1.0 = Band 0-31)
float sampleBand(sampler2D tex, float x) {
    return texture(tex, vec2(x, 0.5)).r;
}

void main() {
    vec2 fragCoord = FlutterFragCoord().xy;
    vec2 uv        = fragCoord / vec2(u_width, u_height);
    vec2 uvc       = uv * 2.0 - 1.0;
    uvc.x         *= u_width / u_height;

    vec3 col = vec3(0.0);

    // ── DNA Feedback Loop (Hintergrund) ──
    {
        vec2 p = uvc;
        p += vec2(u_warp_x, u_warp_y) * sin(p.yx * 3.0 + u_time);
        p  = rot(u_rotation * u_time * 0.1) * p;
        p *= u_zoom + u_bass_left * u_param11 * 0.5;

        for (int i = 0; i < 4; i++) {
            float fi = float(i);
            p = abs(p) / dot(p, p) - 0.9;
            p = rot(u_time * 0.05 * (fi + 1.0) * u_param8) * p;
        }

        float hue = u_time * u_param9 * 0.05
                  + u_energy * 0.3
                  + u_beat_phase * 0.1;
        float sat = 0.7 + u_stereo_width * 0.3;
        float val = length(p) * 0.3 + u_energy * 0.4;
        col += hsv2rgb(vec3(hue, sat, val)) * 0.6;
    }

    // ── FFT Bänder (oben) ──
    {
        float bar_y = 1.0 - 0.15;
        if (uv.y > bar_y) {
            float local_y  = (uv.y - bar_y) / 0.15;
            float left     = sampleBand(u_fft_left,  uv.x);
            float right    = sampleBand(u_fft_right, uv.x);
            float is_left  = step(local_y, left);
            float is_right = step(local_y, right);
            vec3 band_col  = vec3(0.0);
            band_col += vec3(0.2, 1.0, 0.4) * is_left  * 0.8;
            band_col += vec3(0.2, 0.4, 1.0) * is_right * 0.8;
            band_col *= 1.0 + u_beat_onset * 0.5;
            col = mix(col, band_col, max(is_left, is_right));
        }
    }

    // ── Stereo Bild (rechts) ──
    {
        float bar_x = 1.0 - 0.06;
        if (uv.x > bar_x) {
            float local_x  = (uv.x - bar_x) / 0.06;
            float mid      = sampleBand(u_fft_mid,  uv.y);
            float side     = sampleBand(u_fft_side, uv.y);
            float is_mid   = step(1.0 - local_x, mid);
            float is_side  = step(1.0 - local_x, side * u_stereo_width);
            vec3 stereo_col = vec3(0.0);
            stereo_col += vec3(0.9, 0.9, 0.9) * is_mid  * 0.7;
            stereo_col += vec3(0.8, 0.3, 1.0) * is_side * 0.9;
            col = mix(col, stereo_col, max(is_mid, is_side));
        }
    }

    // ── Beat Puls ──
    {
        vec2  bc      = vec2(-0.75, -0.75);
        float radius  = 0.08 + (1.0 - u_beat_phase) * 0.06 + u_bass_left * 0.04;
        float dist    = length(uvc - bc);
        float ring    = smoothstep(radius + 0.01, radius, dist)
                      * smoothstep(radius - 0.03, radius, dist);
        float bn      = clamp((u_bpm - 60.0) / 140.0, 0.0, 1.0);
        vec3  bc_col  = mix(vec3(0.2, 0.4, 1.0), vec3(1.0, 0.2, 0.2), bn);
        col += bc_col * ring * (1.0 + u_beat_onset * 2.0);
    }

    // ── Energie Aura ──
    {
        float dist = length(uvc - vec2(0.75, -0.75));
        float aura = exp(-dist * (3.0 - u_energy * 2.0));
        col += mix(vec3(0.1, 0.3, 0.8), vec3(1.0, 0.5, 0.1), u_energy) * aura * 0.5;
    }

    // ── Vignette + Beat Flash ──
    col *= 1.0 - dot(uvc * 0.4, uvc * 0.4);
    col += u_beat_onset * 0.08;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
