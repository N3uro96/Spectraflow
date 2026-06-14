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

// ── DNA ────────────────────────────────────────────────────
uniform float u_dna_zoom;        // 11
uniform float u_dna_rotation;    // 12
uniform float u_dna_warp_x;      // 13
uniform float u_dna_warp_y;      // 14
uniform float u_dna_wave_freq;   // 15
uniform float u_dna_color_speed; // 16
uniform float u_dna_spokes;      // 17
uniform float u_dna_bass_react;  // 18
uniform float u_dna_mid_react;   // 19
uniform float u_dna_phase;       // 20

// ── Palette (4 Stops × RGB) ────────────────────────────────
uniform vec3 u_pal_shadow;    // 21–23
uniform vec3 u_pal_low;       // 24–26
uniform vec3 u_pal_high;      // 27–29
uniform vec3 u_pal_highlight; // 30–32

// ── Feedback ───────────────────────────────────────────────
uniform float u_fb_zoom;      // 33
uniform float u_fb_rotation;  // 34
uniform float u_fb_decay;     // 35
uniform float u_fb_warp_x;    // 36
uniform float u_fb_warp_y;    // 37

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
    return vec2(c, -s); // used as: rotated = vec2(dot(v, rot2(a)), dot(v, rot2(a + 1.5708)))
}

// ── Tunnel-Grid für einen Farbkanal ───────────────────────
float get_tunnel_lines(vec2 uv, float z_offset, float beat_phase) {
    float radius = length(uv);
    radius -= u_bass * 0.2 * u_dna_bass_react;
    radius  = max(radius, 0.001);

    float angle = atan(uv.y, uv.x);
    angle += u_time * (u_dna_rotation * 0.5) + u_mid * 0.8 * u_dna_mid_react;

    float z     = 1.0 / radius;
    float z_spd = u_time * (1.0 + u_dna_zoom + u_energy * 4.0) + z_offset;
    vec2  tuv   = vec2(angle * 2.0 / 3.14159, z + z_spd);

    vec2  grid      = fract(tuv) - 0.5;
    float thickness = 0.015 + u_high * 0.06 * u_dna_bass_react;
    return neon_glow(grid.x, thickness) + neon_glow(grid.y, thickness);
}

void main() {
    vec2 uv_raw = FlutterFragCoord().xy / vec2(u_width, u_height);
    vec2 uv     = uv_raw * 2.0 - 1.0;
    uv.x       *= u_width / u_height;
    vec2 uv0    = uv;

    // ── Milkdrop Feedback Pass ─────────────────────────────
    // Vorheriges Frame als Textur: Zoom + Rotation + Warp + Decay
    vec2 fb = uv_raw - 0.5;
    fb /= u_fb_zoom;
    // Rotation des Feedback-Buffers
    float co = cos(-u_fb_rotation), si = sin(-u_fb_rotation);
    fb = vec2(fb.x * co - fb.y * si, fb.x * si + fb.y * co);
    // Milkdrop-Vertex-Warp: Sinuswellen-Verzerrung des Samplings
    fb.x += sin(fb.y * 8.0 + u_time * 0.7) * u_fb_warp_x;
    fb.y += cos(fb.x * 8.0 - u_time * 0.5) * u_fb_warp_y;
    vec2 fb_uv = fb + 0.5;
    // Sanfter Edge-Fade — kein harter Rand
    vec2 ef   = smoothstep(vec2(0.0), vec2(0.04), fb_uv)
              * (vec2(1.0) - smoothstep(vec2(0.96), vec2(1.0), fb_uv));
    vec3 feedback = texture(u_prev_frame, clamp(fb_uv, 0.001, 0.999)).rgb
                  * u_fb_decay * (ef.x * ef.y);

    // ── Beat Phase ─────────────────────────────────────────
    float beat_dur   = 60.0 / max(u_bpm, 60.0);
    float beat_phase = fract(u_time / beat_dur);
    float beat_kick  = exp(-beat_phase * 9.0);

    // ── Camera Shake auf Beat ──────────────────────────────
    float shake = exp(-beat_phase * 5.0) * u_energy * 0.05 * u_dna_bass_react;
    uv.x += (fract(sin(u_time * 112.3) * 43758.545) - 0.5) * shake;
    uv.y += (fract(cos(u_time *  73.1) * 43758.545) - 0.5) * shake;

    // ── DNA Warp ───────────────────────────────────────────
    float warp_boost = 1.0 + u_energy * 3.0;
    uv.x += sin(uv.y * u_dna_wave_freq + u_time * 0.5) * u_dna_warp_x * warp_boost;
    uv.y += cos(uv.x * u_dna_wave_freq - u_time * 0.5) * u_dna_warp_y * warp_boost;

    // ── Chromatische Aberration: RGB-Split ─────────────────
    float rgb_split = u_bass * 0.06 + u_energy * 0.02;
    float lines_r   = get_tunnel_lines(uv * (1.0 - rgb_split), 0.00, beat_phase);
    float lines_g   = get_tunnel_lines(uv,                      0.05, beat_phase);
    float lines_b   = get_tunnel_lines(uv * (1.0 + rgb_split), 0.10, beat_phase);

    // ── Farbe ──────────────────────────────────────────────
    float hue_shift = u_time * 0.04 * u_dna_color_speed + u_dna_phase / 6.28318;
    vec3  col_base  = pal(fract(hue_shift));
    vec3  col_bass  = u_pal_highlight * u_bass * u_dna_bass_react;
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
