#include <flutter/runtime_effect.glsl>

// ── Audio Uniforms ──
uniform float u_time;
uniform float u_width;
uniform float u_height;
uniform float u_bass;
uniform float u_mid;
uniform float u_high;
uniform float u_energy;
uniform float u_bpm;
uniform float u_stereo;
uniform float u_bass_left;
uniform float u_bass_right;

// ── DNA Uniforms ──
uniform float u_dna_zoom;
uniform float u_dna_rotation;
uniform float u_dna_warp_x;
uniform float u_dna_warp_y;
uniform float u_dna_wave_freq;
uniform float u_dna_color_speed;
uniform float u_dna_spokes;
uniform float u_dna_bass_react;
uniform float u_dna_mid_react;
uniform float u_dna_phase;

// ── Palette Uniforms (4 Stops, je RGB) ──
uniform vec3 u_pal_shadow;     // Stop 0 — dunkelst
uniform vec3 u_pal_low;        // Stop 1
uniform vec3 u_pal_high;       // Stop 2
uniform vec3 u_pal_highlight;  // Stop 3 — hellst / lebendigst

out vec4 fragColor;

// 4-Stop Gradient
vec3 palette(float t) {
    t = clamp(t, 0.0, 1.0);
    if (t < 0.333) return mix(u_pal_shadow,    u_pal_low,       t * 3.0);
    if (t < 0.667) return mix(u_pal_low,        u_pal_high,      (t - 0.333) * 3.0);
    return               mix(u_pal_high,        u_pal_highlight, (t - 0.667) * 3.0);
}

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

vec3 tunnelColor(float t, float time, float energy) {
    float pos = fract(t * 0.3 * u_dna_color_speed
                    + time * 0.05 * u_dna_color_speed
                    + u_dna_phase / 6.28318);
    return palette(pos) * (0.5 + energy * 0.5);
}

void main() {
    vec2 fragCoord = FlutterFragCoord().xy;
    vec2 uv        = fragCoord / vec2(u_width, u_height);
    vec2 center    = uv - 0.5;
    center.x      *= u_width / u_height;

    // ── Beat Phase ──
    float beat_duration = 60.0 / max(u_bpm, 60.0);
    float beat_phase    = fract(u_time / beat_duration);
    float beat_pulse    = smoothstep(1.0, 0.0, beat_phase * 4.0);

    // ── Stereo Differenz ──
    float stereo_diff = u_bass_left - u_bass_right;

    // ── Warp ──
    vec2 warped = center;

    float zoom = u_dna_zoom
        + u_bass * 0.025 * u_dna_bass_react
        + beat_pulse * 0.015;
    warped *= zoom;

    float angle = u_time * 0.08 * u_dna_rotation
        + u_mid * 0.15 * u_dna_mid_react
        + stereo_diff * 0.2;
    warped = rot(angle) * warped;

    float warp_strength = 0.015 * (1.0 + u_high * 2.0 + beat_pulse * 0.5);
    warped += vec2(
        sin(warped.y * u_dna_wave_freq + u_time * 0.7 + u_dna_warp_x * 10.0)
            * warp_strength * (1.0 + abs(u_dna_warp_x) * 3.0),
        cos(warped.x * u_dna_wave_freq + u_time * 0.5 + u_dna_warp_y * 10.0)
            * warp_strength * (1.0 + abs(u_dna_warp_y) * 3.0)
    );

    // ── Tunnel Geometrie ──
    vec2  p = center;
    float r = length(p);
    float a = atan(p.y, p.x);

    float speed  = 0.35 + u_bass * 0.4 * u_dna_bass_react + beat_pulse * 0.15;
    float tunnel = fract(0.8 / (r + 0.05) - u_time * speed);

    // Speichen aus DNA
    float spoke = smoothstep(0.90, 0.97, abs(sin(a * u_dna_spokes * 0.5)));

    // ── Stereo L/R ──
    float stereo_offset = u_stereo * 0.04;
    vec2  p_left  = p + vec2( stereo_offset * u_bass_left,  0.0);
    vec2  p_right = p + vec2(-stereo_offset * u_bass_right, 0.0);
    float tunnel_l = fract(0.8 / (length(p_left)  + 0.05) - u_time * speed);
    float tunnel_r = fract(0.8 / (length(p_right) + 0.05) - u_time * speed);

    // ── Farben aus Palette ──
    vec3 col_c = tunnelColor(tunnel,   u_time,       u_energy);
    vec3 col_l = tunnelColor(tunnel_l, u_time + 0.1, u_energy);
    vec3 col_r = tunnelColor(tunnel_r, u_time + 0.2, u_energy);

    float lr_mix = uv.x;
    vec3 col = mix(
        mix(col_c, col_l, u_stereo * 0.4 * (1.0 - lr_mix)),
        mix(col_c, col_r, u_stereo * 0.4 * lr_mix),
        u_stereo * 0.3
    );

    // Speichen: Shadow-Farbe der Palette
    col = mix(col, u_pal_shadow * 0.4, spoke);

    // Tunnel Helligkeit
    col *= 0.3 + tunnel * 0.7;

    // ── Glow ──
    float glow = exp(-r * (3.5 - u_energy * 1.5));
    glow      *= 1.0 + u_bass * 0.8 * u_dna_bass_react + beat_pulse * 0.5;
    col       += palette(u_time * 0.08 * u_dna_color_speed) * glow * 0.7;

    // ── Beat Flash mit Highlight-Farbe der Palette ──
    col += beat_pulse * 0.08 * u_pal_highlight;

    // ── Vignette ──
    float vig = 1.0 - dot(center * 1.3, center * 1.3);
    col      *= clamp(vig, 0.0, 1.0);

    // ── Chromatische Aberration ──
    float ca     = u_bass * 0.006 * u_dna_bass_react + beat_pulse * 0.004;
    vec2  p_ca_r = center + vec2(ca, 0.0);
    vec2  p_ca_b = center - vec2(ca, 0.0);
    float t_ca_r = fract(0.8 / (length(p_ca_r) + 0.05) - u_time * speed);
    float t_ca_b = fract(0.8 / (length(p_ca_b) + 0.05) - u_time * speed);
    col.r = mix(col.r, tunnelColor(t_ca_r, u_time, u_energy).r, 0.3);
    col.b = mix(col.b, tunnelColor(t_ca_b, u_time, u_energy).b, 0.3);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
