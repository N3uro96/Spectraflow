#include <flutter/runtime_effect.glsl>

// ── Audio ──────────────────────────────────────────────────
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

// ── DNA ────────────────────────────────────────────────────
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

// ── Palette (4 Stops × RGB) ────────────────────────────────
uniform vec3 u_pal_shadow;
uniform vec3 u_pal_low;
uniform vec3 u_pal_high;
uniform vec3 u_pal_highlight;

out vec4 fragColor;

// ── 4-Stop Palette ─────────────────────────────────────────
vec3 pal(float t) {
    t = clamp(t, 0.0, 1.0);
    if (t < 0.333) return mix(u_pal_shadow,    u_pal_low,       t * 3.0);
    if (t < 0.667) return mix(u_pal_low,        u_pal_high,      (t - 0.333) * 3.0);
    return               mix(u_pal_high,        u_pal_highlight, (t - 0.667) * 3.0);
}

// ── Neon-Glow Hilfsfunktion ────────────────────────────────
float neon_glow(float x, float thickness) {
    return thickness / (abs(x) + 0.005);
}

// ── Tunnel-Grid für einen Farbkanal ───────────────────────
float get_tunnel_lines(vec2 uv, float z_offset, float beat_phase) {
    float radius = length(uv);

    // Tunnel atmet mit Bass (DNA-gesteuert)
    radius -= u_bass * 0.2 * u_dna_bass_react;
    radius  = max(radius, 0.001);

    float angle = atan(uv.y, uv.x);

    // Rotation: DNA gibt Grundspeed, Mid beschleunigt
    angle += u_time * (u_dna_rotation * 0.5) + u_mid * 0.8 * u_dna_mid_react;

    float z = 1.0 / radius;

    // Vorwärtsbewegung: Zoom + Energie treiben die Geschwindigkeit
    float z_speed = u_time * (1.0 + u_dna_zoom + u_energy * 4.0) + z_offset;
    vec2  tun_uv  = vec2(angle * 2.0 / 3.14159, z + z_speed);

    // Grid mit audio-reaktiver Liniendicke
    vec2  grid      = fract(tun_uv) - 0.5;
    float thickness = 0.015 + u_high * 0.06 * u_dna_bass_react;
    return neon_glow(grid.x, thickness) + neon_glow(grid.y, thickness);
}

void main() {
    vec2 uv_raw = FlutterFragCoord().xy / vec2(u_width, u_height);
    vec2 uv     = uv_raw * 2.0 - 1.0;
    uv.x       *= u_width / u_height;
    vec2 uv0    = uv; // unverändertes UV für Vignette

    // ── Beat Phase aus BPM ─────────────────────────────────
    float beat_dur   = 60.0 / max(u_bpm, 60.0);
    float beat_phase = fract(u_time / beat_dur);
    float beat_kick  = exp(-beat_phase * 9.0);

    // ── Camera Shake auf Beat ──────────────────────────────
    float shake = exp(-beat_phase * 5.0) * u_energy * 0.05 * u_dna_bass_react;
    uv.x += (fract(sin(u_time * 112.3) * 43758.545) - 0.5) * shake;
    uv.y += (fract(cos(u_time *  73.1) * 43758.545) - 0.5) * shake;

    // ── DNA Warp (verstärkt sich massiv mit Energie) ───────
    float warp_boost = 1.0 + u_energy * 3.0;
    uv.x += sin(uv.y * u_dna_wave_freq + u_time * 0.5) * u_dna_warp_x * warp_boost;
    uv.y += cos(uv.x * u_dna_wave_freq - u_time * 0.5) * u_dna_warp_y * warp_boost;

    // ── Chromatische Aberration: RGB-Split pro Kanal ───────
    float rgb_split = u_bass * 0.06 + u_energy * 0.02;
    float lines_r   = get_tunnel_lines(uv * (1.0 - rgb_split), 0.00, beat_phase);
    float lines_g   = get_tunnel_lines(uv,                      0.05, beat_phase);
    float lines_b   = get_tunnel_lines(uv * (1.0 + rgb_split), 0.10, beat_phase);

    // ── Farbe aus Palette ──────────────────────────────────
    float hue_shift = u_time * 0.04 * u_dna_color_speed + u_dna_phase / 6.28318;
    vec3  col_base  = pal(fract(hue_shift));
    vec3  col_bass  = u_pal_highlight * u_bass * u_dna_bass_react;
    vec3  grid_col  = col_base + col_bass;

    vec3 col = vec3(
        grid_col.r * lines_r,
        grid_col.g * lines_g,
        grid_col.b * lines_b
    ) * 0.1;

    // ── Pulsierender Kern ──────────────────────────────────
    float radius        = length(uv);
    float core_intensity = exp(-radius * (3.5 - u_energy * 2.0));
    col += (u_pal_high * u_energy * 2.0 + u_pal_highlight * beat_kick) * core_intensity;

    // ── Stereo L/R Lichtstreifen ───────────────────────────
    float s_off = u_stereo * 0.03;
    float r_L   = length(uv + vec2( s_off * u_bass_left,  0.0));
    float r_R   = length(uv - vec2( s_off * u_bass_right, 0.0));
    col += u_pal_low * exp(-r_L * 5.0) * u_bass_left  * u_stereo * 0.3;
    col += u_pal_low * exp(-r_R * 5.0) * u_bass_right * u_stereo * 0.3;

    // ── Fog / Tiefenschwärze ───────────────────────────────
    float z   = 1.0 / max(radius - u_bass * 0.2, 0.001);
    float fog = smoothstep(0.0, 6.0, z);
    col = mix(col, vec3(0.0), fog);

    // ── Beat Flash ─────────────────────────────────────────
    col += beat_kick * 0.1 * u_pal_highlight;

    // ── Vignette ──────────────────────────────────────────
    float vig = 1.0 - dot(uv0 * 1.3, uv0 * 1.3);
    col      *= clamp(vig, 0.0, 1.0);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
