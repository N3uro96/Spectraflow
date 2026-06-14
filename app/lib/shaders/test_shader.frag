#include <flutter/runtime_effect.glsl>

uniform float u_time;
uniform vec2  u_resolution;
uniform float u_fft_left[32];
uniform float u_fft_right[32];
uniform float u_fft_mid[32];
uniform float u_fft_side[32];
uniform float u_env_left[32];
uniform float u_env_right[32];
uniform float u_bass_left;
uniform float u_bass_right;
uniform float u_mid_left;
uniform float u_mid_right;
uniform float u_high_left;
uniform float u_high_right;
uniform float u_energy;
uniform float u_bpm;
uniform float u_beat_phase;
uniform float u_beat_onset;
uniform float u_stereo_width;
uniform float u_zoom;
uniform float u_rotation;
uniform float u_warp_x;
uniform float u_warp_y;
uniform float u_dx;
uniform float u_dy;
uniform float u_params[16];

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

// SkSL erlaubt keine dynamischen Array-Indizes
// Wir sampeln die FFT Bänder als kontinuierliche Kurve
float sampleFFT(float x, float[32] bands) {
    float pos    = clamp(x * 31.0, 0.0, 31.0);
    float pos_lo = floor(pos);
    float pos_hi = ceil(pos);
    float t      = fract(pos);

    // Manuelles Lookup für die zwei nächsten Bänder
    // via stufenweise if-Kette (SkSL kompatibel)
    float lo = 0.0;
    float hi = 0.0;

    if (pos_lo < 1.0)       { lo = bands[0];  hi = bands[1];  }
    else if (pos_lo < 2.0)  { lo = bands[1];  hi = bands[2];  }
    else if (pos_lo < 3.0)  { lo = bands[2];  hi = bands[3];  }
    else if (pos_lo < 4.0)  { lo = bands[3];  hi = bands[4];  }
    else if (pos_lo < 5.0)  { lo = bands[4];  hi = bands[5];  }
    else if (pos_lo < 6.0)  { lo = bands[5];  hi = bands[6];  }
    else if (pos_lo < 7.0)  { lo = bands[6];  hi = bands[7];  }
    else if (pos_lo < 8.0)  { lo = bands[7];  hi = bands[8];  }
    else if (pos_lo < 9.0)  { lo = bands[8];  hi = bands[9];  }
    else if (pos_lo < 10.0) { lo = bands[9];  hi = bands[10]; }
    else if (pos_lo < 11.0) { lo = bands[10]; hi = bands[11]; }
    else if (pos_lo < 12.0) { lo = bands[11]; hi = bands[12]; }
    else if (pos_lo < 13.0) { lo = bands[12]; hi = bands[13]; }
    else if (pos_lo < 14.0) { lo = bands[13]; hi = bands[14]; }
    else if (pos_lo < 15.0) { lo = bands[14]; hi = bands[15]; }
    else if (pos_lo < 16.0) { lo = bands[15]; hi = bands[16]; }
    else if (pos_lo < 17.0) { lo = bands[16]; hi = bands[17]; }
    else if (pos_lo < 18.0) { lo = bands[17]; hi = bands[18]; }
    else if (pos_lo < 19.0) { lo = bands[18]; hi = bands[19]; }
    else if (pos_lo < 20.0) { lo = bands[19]; hi = bands[20]; }
    else if (pos_lo < 21.0) { lo = bands[20]; hi = bands[21]; }
    else if (pos_lo < 22.0) { lo = bands[21]; hi = bands[22]; }
    else if (pos_lo < 23.0) { lo = bands[22]; hi = bands[23]; }
    else if (pos_lo < 24.0) { lo = bands[23]; hi = bands[24]; }
    else if (pos_lo < 25.0) { lo = bands[24]; hi = bands[25]; }
    else if (pos_lo < 26.0) { lo = bands[25]; hi = bands[26]; }
    else if (pos_lo < 27.0) { lo = bands[26]; hi = bands[27]; }
    else if (pos_lo < 28.0) { lo = bands[27]; hi = bands[28]; }
    else if (pos_lo < 29.0) { lo = bands[28]; hi = bands[29]; }
    else if (pos_lo < 30.0) { lo = bands[29]; hi = bands[30]; }
    else                    { lo = bands[30]; hi = bands[31]; }

    return mix(lo, hi, t);
}

void main() {
    vec2 fragCoord = FlutterFragCoord().xy;
    vec2 uv        = fragCoord / u_resolution;
    vec2 uvc       = uv * 2.0 - 1.0;
    uvc.x         *= u_resolution.x / u_resolution.y;

    vec3 col = vec3(0.0);

    // ── DNA Feedback Loop (Hintergrund) ──
    {
        vec2 p = uvc;
        p += vec2(u_warp_x, u_warp_y) * sin(p.yx * 3.0 + u_time);
        p  = rot(u_rotation * u_time * 0.1) * p;
        float zoom = u_zoom + u_bass_left * u_params[11] * 0.5;
        p *= zoom;

        for (int i = 0; i < 4; i++) {
            float fi = float(i);
            p  = abs(p) / dot(p, p) - 0.9 + u_params[i] * 0.1;
            p  = rot(u_time * 0.05 * (fi + 1.0) * u_params[8]) * p;
        }

        float hue = u_time * u_params[9] * 0.05
                  + u_energy * 0.3
                  + u_beat_phase * 0.1;
        float sat = 0.7 + u_stereo_width * 0.3;
        float val = length(p) * 0.3 + u_energy * 0.4;
        col += hsv2rgb(vec3(hue, sat, val)) * 0.6;
    }

    // ── FFT Bänder (oben) – kontinuierlich gesampelt ──
    {
        float bar_height = 0.15;
        float bar_y      = 1.0 - bar_height;

        if (uv.y > bar_y) {
            float local_y = (uv.y - bar_y) / bar_height;
            float left    = sampleFFT(uv.x, u_env_left);
            float right   = sampleFFT(uv.x, u_env_right);

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
        float bar_width = 0.06;
        float bar_x     = 1.0 - bar_width;

        if (uv.x > bar_x) {
            float local_x = (uv.x - bar_x) / bar_width;
            float mid     = sampleFFT(uv.y, u_fft_mid);
            float side    = sampleFFT(uv.y, u_fft_side);

            float is_mid  = step(1.0 - local_x, mid);
            float is_side = step(1.0 - local_x, side * u_stereo_width);

            vec3 stereo_col = vec3(0.0);
            stereo_col += vec3(0.9, 0.9, 0.9) * is_mid  * 0.7;
            stereo_col += vec3(0.8, 0.3, 1.0) * is_side * 0.9;

            col = mix(col, stereo_col, max(is_mid, is_side));
        }
    }

    // ── Beat Puls (unten links) ──
    {
        vec2  beat_center = vec2(-0.75, -0.75);
        float beat_pulse  = 1.0 - u_beat_phase;
        float beat_radius = 0.08 + beat_pulse * 0.06 + u_bass_left * 0.04;
        float dist        = length(uvc - beat_center);
        float ring        = smoothstep(beat_radius + 0.01, beat_radius, dist)
                          * smoothstep(beat_radius - 0.03, beat_radius, dist);
        float bpm_norm    = clamp((u_bpm - 60.0) / 140.0, 0.0, 1.0);
        vec3  beat_col    = mix(vec3(0.2, 0.4, 1.0), vec3(1.0, 0.2, 0.2), bpm_norm);
        col += beat_col * ring * (1.0 + u_beat_onset * 2.0);
    }

    // ── Energie Aura (unten rechts) ──
    {
        vec2  energy_center = vec2(0.75, -0.75);
        float dist          = length(uvc - energy_center);
        float aura          = exp(-dist * (3.0 - u_energy * 2.0));
        vec3  energy_col    = mix(
            vec3(0.1, 0.3, 0.8),
            vec3(1.0, 0.5, 0.1),
            u_energy
        );
        col += energy_col * aura * 0.5;
    }

    // ── Vignette ──
    float vignette = 1.0 - dot(uvc * 0.4, uvc * 0.4);
    col *= vignette;

    // ── Beat Flash ──
    col += u_beat_onset * 0.08;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
