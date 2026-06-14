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

// ── Palette ────────────────────────────────────────────────
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

uniform sampler2D u_prev_frame; // sampler 0

out vec4 fragColor;

// ── 4-Stop Palette ─────────────────────────────────────────
vec3 pal(float t) {
    t = clamp(t, 0.0, 1.0);
    if (t < 0.333) return mix(u_pal_shadow,    u_pal_low,       t * 3.0);
    if (t < 0.667) return mix(u_pal_low,        u_pal_high,      (t - 0.333) * 3.0);
    return               mix(u_pal_high,        u_pal_highlight, (t - 0.667) * 3.0);
}

void main() {
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
    vec2 ef    = smoothstep(vec2(0.0), vec2(0.04), fb_uv)
               * (vec2(1.0) - smoothstep(vec2(0.96), vec2(1.0), fb_uv));
    vec3 feedback = texture(u_prev_frame, clamp(fb_uv, 0.001, 0.999)).rgb
                  * u_fb_decay * (ef.x * ef.y);

    // ── Beat ───────────────────────────────────────────────
    float beat_dur   = 60.0 / max(u_bpm, 60.0);
    float beat_phase = fract(u_time / beat_dur);
    float beat_kick  = exp(-beat_phase * 8.0);

    // ── Camera Shake ───────────────────────────────────────
    float shake = beat_kick * u_energy * 0.04 * u_dna_bass_react;
    uv.x += (fract(sin(u_time * 127.1) * 43758.5) - 0.5) * shake;
    uv.y += (fract(cos(u_time *  89.3) * 43758.5) - 0.5) * shake;

    // ── Kaleidoskop-Fold (Anzahl Segmente = DNA spokes) ────
    // spokes 2–10 → n_folds Segmente → Tunnel-Geometrie komplett anders
    float n_folds = max(2.0, floor(u_dna_spokes));
    float seg     = 6.28318 / n_folds;

    float r0 = length(uv);
    float a0 = atan(uv.y, uv.x);

    // Kontinuierliche Kaleidoskop-Rotation (DNA rotation)
    a0 += u_time * u_dna_rotation * 0.12;

    // In ein Segment falten + spiegeln
    a0 = mod(a0 + seg * 0.5, seg) - seg * 0.5;
    a0 = abs(a0); // Spiegelpunkt → [0, seg/2]

    // Kartesische Koordinaten in gefalteter Welt
    vec2 uv_k = vec2(cos(a0), sin(a0)) * r0;

    // ── Organische Domain-Warp (warpX/Y) ──────────────────
    uv_k.x += sin(uv_k.y * u_dna_wave_freq + u_time * 0.35) * u_dna_warp_x * 0.22;
    uv_k.y += cos(uv_k.x * u_dna_wave_freq - u_time * 0.28) * u_dna_warp_y * 0.22;

    // ── Tunnel-Tiefe ───────────────────────────────────────
    float r = length(uv_k);

    // AUFWEITUNG: Bass verschiebt Ringe nach außen.
    // Jeder Ring bei Tiefe z erscheint auf Bildschirm bei r = 1/z + bass_expand
    float bass_expand = u_bass * u_dna_bass_react * 0.20 + beat_kick * 0.07;
    float r_adj       = max(r - bass_expand, 0.001);
    float z           = 1.0 / r_adj;

    // Tunnelgeschwindigkeit: DNA zoom + Energie
    float z_speed = u_time * (0.8 + u_dna_zoom * 0.55 + u_energy * 1.4);
    float z_anim  = z + z_speed;

    // Innenrotation des Tunnels
    float a_rot = a0 + u_time * u_dna_rotation * 0.28 + u_mid * u_dna_mid_react * 0.22;

    // ── 3 Tiefenmuster — welches dominiert bestimmt der Seed ──

    // style_t: 0 = Neon (dünne Linien), 1 = Volumetrisch (weiches Leuchten)
    // → gesteuert von u_dna_zoom (0.7–1.4)
    float style_t = clamp((u_dna_zoom - 0.7) / 0.7, 0.0, 1.0);

    // pat_t: 0 = Ringe, 0.5 = Speichen, 1 = Gitter
    // → gesteuert von u_dna_phase (0–2π)
    float pat_t = fract(u_dna_phase / 6.28318);

    // — Muster A: Ringe (konzentrisch, rasen auf Betrachter zu) —
    float ring_freq = 3.0 + u_dna_wave_freq * 0.75;
    float ring_pos  = fract(z_anim * ring_freq) - 0.5;
    float thick_r   = 0.025 + u_high * 0.05;
    float neon_ring = thick_r / (abs(ring_pos) + 0.004);        // scharf neon
    float vol_ring  = smoothstep(0.45, 0.0, abs(ring_pos));     // weich volumetrisch
    float rings     = mix(neon_ring * 0.12, vol_ring, style_t);

    // — Muster B: Speichen (radiale Linien, Anzahl = Fold-Segmente) —
    // abs(sin(a * n)) erzeugt n_folds Maxima pro Umlauf → glühende Segmentkanten
    float spoke_val  = abs(sin(a_rot * n_folds * 0.5));
    float thick_s    = 0.025 + u_mid * 0.04;
    float neon_spoke = thick_s / (abs(1.0 - spoke_val) + 0.005);
    float vol_spoke  = smoothstep(0.55, 0.95, spoke_val);
    float spokes     = mix(neon_spoke * 0.10, vol_spoke, style_t);

    // — Muster C: Gitter (Ringe × Speichen) — Kreuzungspunkte leuchten —
    float grid_pat = rings * spokes * 3.5;

    // Blend nach pat_t (sanft zwischen den 3 Modi)
    float pattern;
    if (pat_t < 0.33) {
        pattern = mix(rings,    spokes,   pat_t * 3.03);
    } else if (pat_t < 0.67) {
        pattern = mix(spokes,   grid_pat, (pat_t - 0.33) * 3.03);
    } else {
        pattern = mix(grid_pat, rings,    (pat_t - 0.67) * 3.03);
    }

    // Tiefenschwärze: Zentrum (unendliche Tiefe) schwarz
    float depth_fog = smoothstep(0.0, 7.0, z);
    pattern *= 1.0 - depth_fog * 0.85;

    // ── Farbe ──────────────────────────────────────────────
    // Tiefenbasierte Hue (Ringe wechseln Farbe mit Tiefe)
    float hue_z = fract(z_anim * 0.065 * u_dna_color_speed);
    // Winkelbasierte Hue-Variation (jedes Segment leicht andere Farbe)
    float hue_a = fract(a_rot / 6.28318 * 0.5 * u_dna_color_speed);
    float hue   = fract(hue_z + hue_a * 0.22 + u_dna_phase / 6.28318);

    vec3 col = pal(hue) * pattern;

    // ── Zentraler Kern-Glow ────────────────────────────────
    float core = exp(-r * (3.2 - u_energy * 2.2));
    col += u_pal_high      * core * (0.4 + u_energy * 1.6);
    col += u_pal_highlight * core * beat_kick * 2.5;

    // ── Beat Flash ─────────────────────────────────────────
    col += beat_kick * 0.10 * u_pal_highlight;

    // ── Stereo L/R Akzent ──────────────────────────────────
    float s_off = u_stereo * 0.04;
    col += u_pal_low * exp(-length(uv + vec2(s_off * u_bass_left,  0.0)) * 6.0)
         * u_bass_left  * u_stereo * 0.22;
    col += u_pal_low * exp(-length(uv - vec2(s_off * u_bass_right, 0.0)) * 6.0)
         * u_bass_right * u_stereo * 0.22;

    // ── Vignette ───────────────────────────────────────────
    float vig = 1.0 - dot(uv0 * 1.25, uv0 * 1.25);
    col *= clamp(vig, 0.0, 1.0);

    // ── Feedback Composite ─────────────────────────────────
    col = feedback + col;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
