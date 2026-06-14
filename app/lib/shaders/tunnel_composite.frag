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

#define PI  3.14159265358979
#define TAU 6.28318530717959

// ── 4-Stop Palette ─────────────────────────────────────────
vec3 pal(float t) {
    t = clamp(t, 0.0, 1.0);
    if (t < 0.333) return mix(u_pal_shadow,    u_pal_low,       t * 3.0);
    if (t < 0.667) return mix(u_pal_low,        u_pal_high,      (t - 0.333) * 3.0);
    return               mix(u_pal_high,        u_pal_highlight, (t - 0.667) * 3.0);
}

mat2 rot2(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

// ── 3-Oktaven FBM Domain Warp ──────────────────────────────
// Verformt UV-Koordinaten organisch auf Basis von DNA-Parametern.
vec2 fbm_warp(vec2 p, float t) {
    float freq = u_dna_wave_freq;
    float amp  = 0.05 * (1.0 + abs(u_dna_warp_x) * 2.5 + abs(u_dna_warp_y) * 2.5);
    vec2  ph   = vec2(u_dna_warp_x * 9.0, u_dna_warp_y * 9.0); // DNA-Phasenversatz

    // Oktave 1
    vec2 d1 = amp * vec2(sin(p.y  * freq       + ph.x + t * 0.31),
                         cos(p.x  * freq       + ph.y + t * 0.23));
    // Oktave 2 (2× Frequenz, ½ Amplitude) — akkumulierter Input
    vec2 d2 = (amp * 0.5) * vec2(sin((p.y + d1.y) * freq * 2.1 + t * 0.47),
                                  cos((p.x + d1.x) * freq * 2.1 + t * 0.37));
    // Oktave 3 (4× Frequenz, ¼ Amplitude) — Feinstruktur
    vec2 d3 = (amp * 0.25) * vec2(sin((p.y + d2.y) * freq * 4.5 + t * 0.71),
                                   cos((p.x + d2.x) * freq * 4.5 + t * 0.61));
    return p + d1 + d2 + d3;
}

// ── Kaleidoskop-Winkel-Fold ─────────────────────────────────
// Faltet den Winkel n-mal — erzeugt Spiegelsymmetrie.
float kaleido(float a, float n) {
    float seg = TAU / n;
    a = mod(a + PI, seg);               // Anfangsoffset damit 0° nicht an Kante liegt
    if (a > seg * 0.5) a = seg - a;
    return a;
}

// ── Tunnel-Farbe ────────────────────────────────────────────
vec3 tunnelCol(float depth_frac, float energy_scale) {
    float t = fract(depth_frac * 0.3 * u_dna_color_speed
                  + u_time    * 0.05 * u_dna_color_speed
                  + u_dna_phase / TAU);
    return pal(t) * (0.35 + energy_scale * 0.65);
}

// ── 3D-Partikel (perspektivisch projiziert) ─────────────────
// Jedes Partikel fliegt auf den Betrachter zu.
float particle(vec2 uv, float idx, float speed) {
    float depth = fract(u_time * speed * 0.3 + idx * 0.1667); // [0,1) = Tiefe im Tunnel
    if (depth < 0.04) return 0.0;                              // Flimmern am Nullpunkt vermeiden

    float z     = 1.0 / max(depth, 0.04);                     // Perspektiv-Tiefe
    float angle = idx * TAU / 6.0 + u_time * 0.12 * u_dna_rotation;
    float radW  = u_dna_zoom * (0.3 + 0.25 * fract(idx * 0.618)); // Goldener-Schnitt-Varianz
    vec2  pos   = vec2(cos(angle), sin(angle)) * radW / z;
    float dist  = length(uv - pos);
    float sz    = 0.006 * (1.0 - depth * 0.4);                // Größer je näher
    return clamp(exp(-dist * dist / max(sz * sz, 1e-6)) * (1.0 - depth * 0.6), 0.0, 1.0);
}

void main() {
    vec2 fragCoord = FlutterFragCoord().xy;
    vec2 uv        = fragCoord / vec2(u_width, u_height);
    vec2 center    = uv - 0.5;
    center.x      *= u_width / u_height;

    // ── Beat Analysis ──────────────────────────────────────
    float beat_dur   = 60.0 / max(u_bpm, 60.0);
    float beat_phase = fract(u_time / beat_dur);
    float beat_pulse = smoothstep(1.0, 0.0, beat_phase * 4.0);  // weicher Puls
    float beat_kick  = smoothstep(1.0, 0.0, beat_phase * 9.0);  // harter Transient

    float stereo_diff = u_bass_left - u_bass_right;

    // ── Kamera-Roll ───────────────────────────────────────
    // DNA-Rotation steuert Grundgeschwindigkeit; Beat gibt Kick; Stereo dreht leicht.
    float roll = u_time * 0.045 * u_dna_rotation
               + u_mid  * 0.09  * u_dna_mid_react
               + stereo_diff    * 0.14
               + beat_kick * 0.07 * sign(u_dna_rotation);
    center = rot2(roll) * center;

    float r = length(center);
    float a = atan(center.y, center.x);

    // ── Kaleidoskop-Fold ──────────────────────────────────
    float n_spokes  = max(2.0, floor(u_dna_spokes));
    float a_folded  = kaleido(a, n_spokes * 2.0); // ×2: jede Speiche gespiegelt

    // ── Nicht-kreisförmiger Querschnitt ──────────────────
    // Addiert Harmonische auf den Radius → Stern-/Blumenform.
    float bumps =
          1.0
        + 0.13  * sin(a * n_spokes       + u_time * 0.22 * u_dna_rotation)
        + 0.065 * sin(a * n_spokes * 2.0 - u_time * 0.15 * u_dna_rotation)
        + 0.03  * sin(a * n_spokes * 3.0 + u_time * 0.37)
        + 0.04  * u_high * sin(a * n_spokes * 1.5 + u_time * 0.5); // High-Freq reagiert

    // Beat dehnt / komprimiert den Querschnitt
    bumps *= 1.0 + beat_pulse * u_dna_bass_react * 0.20
                 + beat_kick  * u_dna_bass_react * 0.08;

    float r_dist = r / max(bumps, 0.03);
    float r_safe = max(r_dist, 0.001);

    // ── Tunnel-Tiefe & Tunnel-UV ──────────────────────────
    float focal = 0.75 * u_dna_zoom;
    float speed = 0.28 + u_bass * 0.38 * u_dna_bass_react + beat_pulse * 0.13;
    float raw_d = focal / r_safe;

    // Normalisierte Tunnel-UV: x = angulär, y = Tiefe
    vec2 tuv = vec2(a_folded * n_spokes / PI, raw_d * 0.07);

    // ── FBM Domain Warp auf Tunnel-UV ─────────────────────
    vec2 tuv_w = fbm_warp(tuv, u_time * 0.38);

    // ── Drei Tiefenschichten ──────────────────────────────
    float d1 = fract(tuv_w.y * 12.0  - u_time * speed);           // Hauptschicht
    float d2 = fract(tuv_w.y * 12.0  - u_time * speed + 0.5);     // Versetzt ½ Phase → Moiré
    float d3 = fract(tuv_w.y *  7.5  - u_time * speed * 1.45);    // Schnellere Innenschicht

    // ── Ring-Rim-Lighting ─────────────────────────────────
    // Leuchtet an Ringgrenzen (fract ≈ 0 oder ≈ 1)
    float rim1 = exp(-min(d1, 1.0 - d1) * 22.0);
    float rim2 = exp(-min(d2, 1.0 - d2) * 18.0);
    float rim3 = exp(-min(d3, 1.0 - d3) * 14.0);

    // ── Speichen ──────────────────────────────────────────
    float spoke_mask = smoothstep(0.87, 0.97, abs(sin(a_folded * n_spokes)));
    float spoke_glow = smoothstep(0.96, 1.0,  abs(sin(a_folded * n_spokes)));

    // ── Farben zusammensetzen ─────────────────────────────
    vec3 col = vec3(0.0);

    // Schicht 1: Haupttunnel
    vec3 c1 = tunnelCol(d1, u_energy);
    c1 *= 0.2 + d1 * 0.8;   // Tiefenverdunklung
    c1 += rim1 * u_pal_highlight * 0.5;
    col += c1;

    // Schicht 2: Versetzt (Moiré / Tiefenstaffelung)
    float ang_fade2 = 0.5 + 0.5 * sin(tuv_w.x * PI);
    vec3 c2 = tunnelCol(d2, u_energy * 0.75) * 0.32 * ang_fade2;
    c2 += rim2 * u_pal_low * 0.3 * ang_fade2;
    col += c2;

    // Schicht 3: Schnellere Innenschicht (Geschwindigkeitsgefühl)
    vec3 c3 = tunnelCol(d3, u_energy * 0.55) * 0.18;
    c3 += rim3 * u_pal_shadow * 0.15;
    col += c3;

    // ── Speichen ──────────────────────────────────────────
    col *= mix(1.0, 0.07, spoke_mask);
    col += spoke_glow * u_pal_highlight * (0.45 + beat_pulse * 0.75 + beat_kick * 0.4);

    // ── Stereo L/R Parallax ───────────────────────────────
    float s_off = u_stereo * 0.03;
    vec2  c_L   = center + vec2( s_off * u_bass_left,  0.0);
    vec2  c_R   = center + vec2(-s_off * u_bass_right, 0.0);
    float d_L   = fract(focal / max(length(c_L), 0.001) * 0.07 - u_time * speed);
    float d_R   = fract(focal / max(length(c_R), 0.001) * 0.07 - u_time * speed);
    col = mix(col, mix(col, tunnelCol(d_L, u_energy), u_stereo * 0.22), 1.0 - uv.x);
    col = mix(col, mix(col, tunnelCol(d_R, u_energy), u_stereo * 0.22),       uv.x);

    // ── Innere Leuchttube (axiale Linie) ─────────────────
    float inner_r = smoothstep(0.1, 0.0, r);
    float d_inner = fract(raw_d * 0.13 - u_time * speed * 1.6);
    col += pal(d_inner) * inner_r * (1.2 + u_energy * 1.8 + beat_kick * 0.8);

    // ── 6 Partikel ────────────────────────────────────────
    float part_spd = 0.45 + u_bass * 0.3 * u_dna_bass_react;
    vec3  part_col = vec3(0.0);
    for (int i = 0; i < 6; i++) {
        float b   = particle(center, float(i), part_spd);
        float hue = float(i) / 6.0 + u_time * 0.06 * u_dna_color_speed;
        part_col += b * pal(fract(hue));
    }
    col += part_col * (0.9 + beat_pulse * 0.6);

    // ── Spektraler Achsen-Streak ──────────────────────────
    float axis = exp(-r * (4.5 - u_energy * 2.0));
    axis      *= 1.0 + beat_pulse * u_dna_bass_react * 1.4
                     + beat_kick  * u_dna_bass_react * 0.8;
    col       += pal(u_time * 0.055 * u_dna_color_speed) * axis * 1.0;

    // ── Beat Flash ────────────────────────────────────────
    col += beat_kick * 0.14 * u_pal_highlight;

    // ── Vignette ──────────────────────────────────────────
    float vig = 1.0 - dot(center * 1.25, center * 1.25);
    col      *= clamp(vig, 0.0, 1.0);

    // ── Radiale Chromatische Aberration ───────────────────
    float ca   = u_bass * 0.008 * u_dna_bass_react + beat_kick * 0.006;
    vec2  cdir = r > 0.001 ? center / r : vec2(1.0, 0.0); // normierter Radialvektor
    float r_r  = length(center + cdir * ca);
    float r_b  = length(center - cdir * ca);
    float d_r  = fract(focal / max(r_r, 0.001) * 0.07 - u_time * speed);
    float d_b  = fract(focal / max(r_b, 0.001) * 0.07 - u_time * speed);
    col.r      = mix(col.r, tunnelCol(d_r, u_energy).r, 0.45);
    col.b      = mix(col.b, tunnelCol(d_b, u_energy).b, 0.45);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
