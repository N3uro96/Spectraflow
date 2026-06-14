#include <flutter/runtime_effect.glsl>

// ── Audio ──────────────────────────────────────────────────
uniform float u_time;        // 0
uniform float u_width;       // 1
uniform float u_height;      // 2
uniform float u_bass;        // 3
uniform float u_mid;         // 4
uniform float u_high;        // 5
uniform float u_energy;      // 6
uniform float u_bpm;         // 7
uniform float u_stereo;      // 8
uniform float u_bass_left;   // 9
uniform float u_bass_right;  // 10

// ── Seed ───────────────────────────────────────────────────
uniform float u_seed;        // 11 → DNA wird im Shader abgeleitet

// ── Palette (4 Stops × RGB) ────────────────────────────────
uniform vec3 u_pal_shadow;    // 12–14
uniform vec3 u_pal_low;       // 15–17
uniform vec3 u_pal_high;      // 18–20
uniform vec3 u_pal_highlight; // 21–23

// ── Feedback ───────────────────────────────────────────────
uniform float u_fb_zoom;      // 24
uniform float u_fb_rotation;  // 25
uniform float u_fb_decay;     // 26
uniform float u_fb_warp_x;    // 27
uniform float u_fb_warp_y;    // 28

// ── Prev Frame Texture (Milkdrop Feedback) ─────────────────
uniform sampler2D u_prev_frame; // sampler 0

out vec4 fragColor;

// ── 4-Stop Palette ─────────────────────────────────────────
vec3 pal(float t) {
    t = clamp(t, 0.0, 1.0);
    if (t < 0.333) return mix(u_pal_shadow,    u_pal_low,       t * 3.0);
    if (t < 0.667) return mix(u_pal_low,        u_pal_high,      (t - 0.333) * 3.0);
    return               mix(u_pal_high,        u_pal_highlight, (t - 0.667) * 3.0);
}

// ── Neon-Glow ──────────────────────────────────────────────
float neon_glow(float x, float thickness) {
    return thickness / (abs(x) + 0.005);
}

// ── 2D Rotation ────────────────────────────────────────────
vec2 rot2(float a) {
    float c = cos(a), s = sin(a);
    return vec2(c, -s);
}

// Deterministischer 1D-Hash aus Seed + Salt
float hash_seed(float seed, float salt) {
    return fract(sin(seed * 12.9898 + salt * 78.233) * 43758.5453);
}

float get_tunnel_lines(vec2 uv, float z_offset, float beat_phase,
                       float d_zoom, float d_rotation, float d_warp_x,
                       float d_warp_y, float d_wave_freq, float d_bass_react,
                       float d_mid_react) {
    float radius = length(uv);
    radius -= u_bass * 0.2 * d_bass_react;
    radius  = max(radius, 0.001);

    float angle = atan(uv.y, uv.x);
    angle += u_time * (d_rotation * 0.5) + u_mid * 0.8 * d_mid_react;

    float z     = 1.0 / radius;
    float z_spd = u_time * (1.0 + d_zoom + u_energy * 4.0) + z_offset;
    vec2  tuv   = vec2(angle * 2.0 / 3.14159, z + z_spd);

    vec2  grid      = fract(tuv) - 0.5;
    float thickness = 0.015 + u_high * 0.06 * d_bass_react;
    return neon_glow(grid.x, thickness) + neon_glow(grid.y, thickness);
}

void main() {
    // ── DNA aus Seed ableiten ──────────────────────────────
    float d_zoom       = 0.7 + hash_seed(u_seed, 1.0) * 0.7;
    float d_rotation   = (0.4 + hash_seed(u_seed, 2.0) * 1.6)
                       * (hash_seed(u_seed, 3.0) > 0.5 ? 1.0 : -1.0);
    float d_warp_x     = (hash_seed(u_seed, 4.0) - 0.5) * 1.2;
    float d_warp_y     = (hash_seed(u_seed, 5.0) - 0.5) * 1.2;
    float d_wave_freq  = 1.0 + hash_seed(u_seed, 6.0) * 7.0;
    float d_color_speed= 0.2 + hash_seed(u_seed, 7.0) * 2.3;
    float d_spokes     = floor(2.0 + hash_seed(u_seed, 8.0) * 8.5);
    float d_bass_react = 0.3 + hash_seed(u_seed, 9.0) * 0.7;
    float d_mid_react  = 0.3 + hash_seed(u_seed, 10.0) * 0.7;
    float d_phase      = hash_seed(u_seed, 11.0) * 6.28318;

    vec2 uv_raw = FlutterFragCoord().xy / vec2(u_width, u_height);
    vec2 uv     = uv_raw * 2.0 - 1.0;
    uv.x       *= u_width / u_height;
    vec2 uv0    = uv;

    // ── Milkdrop Feedback Pass ─────────────────────────────
    vec2 fb = uv_raw - 0.5;
    fb /= u_fb_zoom;
    float co = cos(-u_fb_rotation), si = sin(-u_fb_rotation);
    fb = vec2(fb.x * co - fb.y * si, fb.x * si + fb.y * co);
    fb.x += sin(fb.y * 8.0 + u_time * 0.7) * u_fb_warp_x;
    fb.y += cos(fb.x * 8.0 - u_time * 0.5) * u_fb_warp_y;
    vec2 fb_uv = fb + 0.5;
    vec2 ef   = smoothstep(vec2(0.0), vec2(0.04), fb_uv)
              * (vec2(1.0) - smoothstep(vec2(0.96), vec2(1.0), fb_uv));
    vec3 feedback = texture(u_prev_frame, clamp(fb_uv, 0.001, 0.999)).rgb
                  * u_fb_decay * (ef.x * ef.y);

    // ── Beat Phase ─────────────────────────────────────────
    float beat_dur   = 60.0 / max(u_bpm, 60.0);
    float beat_phase = fract(u_time / beat_dur);
    float beat_kick  = exp(-beat_phase * 9.0);

    // ── Camera Shake auf Beat ──────────────────────────────
    float shake = exp(-beat_phase * 5.0) * u_energy * 0.05 * d_bass_react;
    uv.x += (fract(sin(u_time * 112.3) * 43758.545) - 0.5) * shake;
    uv.y += (fract(cos(u_time *  73.1) * 43758.545) - 0.5) * shake;

    // ── DNA Warp ───────────────────────────────────────────
    float warp_boost = 1.0 + u_energy * 3.0;
    uv.x += sin(uv.y * d_wave_freq + u_time * 0.5) * d_warp_x * warp_boost;
    uv.y += cos(uv.x * d_wave_freq - u_time * 0.5) * d_warp_y * warp_boost;

    // ── Chromatische Aberration: RGB-Split ─────────────────
    float rgb_split = u_bass * 0.06 + u_energy * 0.02;
    float lines_r   = get_tunnel_lines(uv * (1.0 - rgb_split), 0.00, beat_phase,
                                       d_zoom, d_rotation, d_warp_x, d_warp_y,
                                       d_wave_freq, d_bass_react, d_mid_react);
    float lines_g   = get_tunnel_lines(uv,                      0.05, beat_phase,
                                       d_zoom, d_rotation, d_warp_x, d_warp_y,
                                       d_wave_freq, d_bass_react, d_mid_react);
    float lines_b   = get_tunnel_lines(uv * (1.0 + rgb_split), 0.10, beat_phase,
                                       d_zoom, d_rotation, d_warp_x, d_warp_y,
                                       d_wave_freq, d_bass_react, d_mid_react);

    // ── Farbe ──────────────────────────────────────────────
    float hue_shift = u_time * 0.04 * d_color_speed + d_phase / 6.28318;
    vec3  col_base  = pal(fract(hue_shift));
    vec3  col_bass  = u_pal_highlight * u_bass * d_bass_react;
    vec3  grid_col  = col_base + col_bass;

    vec3 new_content = vec3(
        grid_col.r * lines_r,
        grid_col.g * lines_g,
        grid_col.b * lines_b
    ) * 0.1;

    // ── Pulsierender Kern ──────────────────────────────────
    float radius        = length(uv);
    float core_intensity = exp(-radius * (3.5 - u_energy * 2.0));
    new_content += (u_pal_high * u_energy * 2.0 + u_pal_highlight * beat_kick) * core_intensity;

    // ── Stereo L/R Lichtstreifen ───────────────────────────
    float s_off = u_stereo * 0.03;
    float r_L   = length(uv + vec2( s_off * u_bass_left,  0.0));
    float r_R   = length(uv - vec2( s_off * u_bass_right, 0.0));
    new_content += u_pal_low * exp(-r_L * 5.0) * u_bass_left  * u_stereo * 0.3;
    new_content += u_pal_low * exp(-r_R * 5.0) * u_bass_right * u_stereo * 0.3;

    // ── Fog / Tiefenschwärze ───────────────────────────────
    float fog_r = length(uv) - u_bass * 0.2;
    float z_fog = 1.0 / max(fog_r, 0.001);
    float fog   = smoothstep(0.0, 6.0, z_fog);
    new_content = mix(new_content, vec3(0.0), fog);

    // ── Beat Flash ─────────────────────────────────────────
    new_content += beat_kick * 0.1 * u_pal_highlight;

    // ── Vignette ──────────────────────────────────────────
    float vig    = 1.0 - dot(uv0 * 1.3, uv0 * 1.3);
    new_content *= clamp(vig, 0.0, 1.0);

    // ── Milkdrop Composite: Feedback + neuer Inhalt ────────
    vec3 col = feedback + new_content;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
