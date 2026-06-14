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

// ── Palette ────────────────────────────────────────────────
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

uniform sampler2D u_prev_frame; // sampler 0

out vec4 fragColor;

// ── Palette ────────────────────────────────────────────────
vec3 pal(float t) {
    t = clamp(t, 0.0, 1.0);
    if (t < 0.333) return mix(u_pal_shadow,    u_pal_low,       t * 3.0);
    if (t < 0.667) return mix(u_pal_low,        u_pal_high,      (t - 0.333) * 3.0);
    return               mix(u_pal_high,        u_pal_highlight, (t - 0.667) * 3.0);
}

// ── Hash (deterministisch, schnell) ───────────────────────
float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    return fract(p * (p + p));
}

vec2 hash21(vec2 p) {
    p = fract(p * vec2(0.1031, 0.1030));
    p += dot(p, p.yx + 33.33);
    return fract((p.xx + p.yx) * p.xy);
}

// Deterministischer 1D-Hash aus Seed + Salt
float hash_seed(float seed, float salt) {
    return fract(sin(seed * 12.9898 + salt * 78.233) * 43758.5453);
}

// ── Partikel-Erscheinung ───────────────────────────────────
float particle_glow(vec2 delta, float r, float n_pts, float zoom_t) {
    float d = length(delta);

    float g_point = exp(-d * d / (r * r * 0.3));
    float g_ring  = exp(-pow(d - r * 0.85, 2.0) / (r * r * 0.06));

    float ang     = atan(delta.y, delta.x);
    float ang_mod = 0.45 + 0.55 * abs(cos(ang * n_pts));
    float g_star  = exp(-d / (r * ang_mod * 1.2));

    float t2 = zoom_t * 2.0;
    return mix(mix(g_point, g_ring, clamp(t2, 0.0, 1.0)),
               g_star, clamp(t2 - 1.0, 0.0, 1.0));
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

    // ── Milkdrop Feedback (Trails automatisch) ─────────────
    vec2 fb = uv_raw - 0.5;
    fb /= u_fb_zoom;
    float co = cos(-u_fb_rotation), si = sin(-u_fb_rotation);
    fb = vec2(fb.x * co - fb.y * si, fb.x * si + fb.y * co);
    fb.x += sin(fb.y * 8.0 + u_time * 0.7) * u_fb_warp_x;
    fb.y += cos(fb.x * 8.0 - u_time * 0.5) * u_fb_warp_y;
    vec2 fb_uv = fb + 0.5;
    vec2 ef    = smoothstep(vec2(0.0), vec2(0.04), fb_uv)
               * (vec2(1.0) - smoothstep(vec2(0.96), vec2(1.0), fb_uv));
    vec3 feedback = texture(u_prev_frame, clamp(fb_uv, 0.001, 0.999)).rgb
                  * u_fb_decay * (ef.x * ef.y);

    // ── Beat ───────────────────────────────────────────────
    float beat_dur   = 60.0 / max(u_bpm, 60.0);
    float beat_phase = fract(u_time / beat_dur);
    float beat_kick  = exp(-beat_phase * 7.0);

    // ── Gemeinsame DNA-Parameter ───────────────────────────
    float zoom_t = clamp((d_zoom - 0.7) / 0.7, 0.0, 1.0);
    float n_pts  = 3.0 + floor(d_wave_freq * 0.5);
    float warp_mag = length(vec2(d_warp_x, d_warp_y));

    vec3 col = vec3(0.0);

    // ════════════════════════════════════════════════════════
    // SCHICHT 1: Worley-Partikelfeld
    // ════════════════════════════════════════════════════════
    {
        float density = 3.5 + d_spokes * 1.4;

        vec2 flow_off = vec2(d_warp_x, d_warp_y) * u_time * 0.05;
        vec2 grid_uv  = (uv + flow_off) * density * 0.5;
        vec2 cell_id  = floor(grid_uv);
        vec2 cell_uv  = fract(grid_uv);

        float glow_r = 0.45 / density;

        for (int dx = -1; dx <= 1; dx++) {
            for (int dy = -1; dy <= 1; dy++) {
                vec2 nb = cell_id + vec2(float(dx), float(dy));
                vec2 h  = hash21(nb + d_phase * 0.0007);

                float phase_p  = h.x * 6.28318;
                float speed_p  = 0.25 + h.x * 0.5;
                float dir_p    = (h.y > 0.5 ? 1.0 : -1.0) * sign(d_rotation + 0.01);

                float r_orb = 0.06 + h.y * 0.14
                            + u_bass * d_bass_react * 0.10
                            + beat_kick * d_bass_react * 0.06;

                float t_p  = u_time * speed_p * abs(d_wave_freq) * 0.25 + phase_p;
                vec2 orbit = r_orb * vec2(cos(t_p * dir_p), sin(t_p * dir_p));

                vec2 perp_orb = vec2(-sin(t_p * dir_p), cos(t_p * dir_p));
                orbit += perp_orb * u_mid * d_mid_react * 0.04
                       * sin(t_p * 2.1 + h.y * 6.28318);

                vec2 p_cell = vec2(0.5) + orbit;

                vec2 delta = (cell_uv - (vec2(float(dx), float(dy)) + p_cell))
                           / (density * 0.5);

                float g = particle_glow(delta, glow_r, n_pts, zoom_t);

                float hue = hash11(h.x * 73.1) + u_time * 0.04 * d_color_speed
                          + d_phase / 6.28318;
                vec3 pcol = pal(fract(hue));

                float bright = 0.5 + u_energy * 0.5 + beat_kick * 0.4 * d_bass_react;
                col += pcol * g * bright * 0.7;
            }
        }
    }

    // ════════════════════════════════════════════════════════
    // SCHICHT 2: Hero-Partikel
    // ════════════════════════════════════════════════════════
    {
        float n_float  = max(2.0, d_spokes);
        float glow_r   = 0.07 + d_zoom * 0.05;

        for (int i = 0; i < 10; i++) {
            float fadeFactor = clamp(n_float - float(i), 0.0, 1.0);
            if (fadeFactor == 0.0) continue;

            float fi  = float(i);
            vec2  h   = hash21(vec2(fi * 13.7, fi * 7.31) + d_phase * 0.002);
            float phase_i = h.x * 6.28318;
            float speed_i = 0.4 + h.x * 0.6;

            float theta0 = (fi / n_float) * 6.28318 + phase_i;
            float omega  = d_rotation * 0.7 + (h.y - 0.5) * 0.3;
            float theta  = theta0 + u_time * omega;

            float r_base = 0.12 + (fi / max(n_float - 1.0, 1.0)) * 0.65 + h.y * 0.1;

            r_base += u_bass * d_bass_react * 0.28;
            r_base += beat_kick * d_bass_react * 0.18;

            vec2 orbit_pos = vec2(cos(theta), sin(theta)) * r_base;

            vec2 drift = vec2(d_warp_x, d_warp_y)
                       * sin(u_time * speed_i * 0.4 + phase_i) * 0.35;
            float drift_blend = warp_mag / 0.85;

            vec2 perp = vec2(-sin(theta), cos(theta));
            vec2 dance = perp * u_mid * d_mid_react
                       * sin(u_time * d_wave_freq * 0.6 + h.y * 6.28318) * 0.18;

            vec2 pos = mix(orbit_pos, orbit_pos + drift, drift_blend) + dance;

            vec2 delta = uv - pos;
            float g    = particle_glow(delta, glow_r, n_pts, zoom_t) * 4.0 * fadeFactor;

            float hue_i = fi / n_float + u_time * 0.05 * d_color_speed
                        + d_phase / 6.28318;
            vec3 pcol   = pal(fract(hue_i));

            float stereo_mod = (i % 2 == 0)
                ? (1.0 + u_bass_left  * u_stereo * 0.6)
                : (1.0 + u_bass_right * u_stereo * 0.6);

            float bright = (0.8 + u_energy * 0.5 + beat_kick * 0.5 * d_bass_react)
                         * stereo_mod;

            col += pcol * g * bright;
        }
    }

    // ── Beat-Explosion: globaler Helligkeitspuls ───────────
    col += beat_kick * 0.08 * u_pal_highlight;
    col *= 1.0 + u_energy * 0.3;

    // ── Vignette ───────────────────────────────────────────
    vec2  vig_uv = uv_raw * 2.0 - 1.0;
    float vig    = 1.0 - smoothstep(0.5, 1.5, dot(vig_uv, vig_uv));
    col         *= vig;

    // ── Feedback Composite (Trails automatisch) ────────────
    col = feedback + col;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
