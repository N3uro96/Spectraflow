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

// ── Palette (für subtilen Tint) ────────────────────────────
vec3 pal(float t) {
    t = clamp(t, 0.0, 1.0);
    if (t < 0.333) return mix(u_pal_shadow,    u_pal_low,       t * 3.0);
    if (t < 0.667) return mix(u_pal_low,        u_pal_high,      (t - 0.333) * 3.0);
    return               mix(u_pal_high,        u_pal_highlight, (t - 0.667) * 3.0);
}

// ── HSV → RGB (klassische Demoscene-Formel) ────────────────
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
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

    // ── Plasma-Parameter ───────────────────────────────────
    // Basisfrequenz: DNA zoom + High treibt Dichte (High → kleinere Zellen)
    float high_boost = 1.0 + u_high * u_dna_bass_react * 2.2;
    float bf         = (1.4 + u_dna_zoom * 0.8) * high_boost;

    // Bass → Wellenamplitude (Zellen werden tiefer/intensiver)
    float ba = 1.0 + u_bass * u_dna_bass_react * 2.0;

    // Zeitantrieb: DNA rotation + Mid beschleunigt Animation
    float tm = u_time * (0.5 + abs(u_dna_rotation) * 0.45)
             + u_mid * u_dna_mid_react * 0.25;

    // Sub-Frequenz-Faktor aus DNA wave_freq
    float wf = u_dna_wave_freq * 0.12;

    // Globaler Phasen-Offset aus DNA phase (verschiebt alle Wellen-Phasen)
    float ph = u_dna_phase;

    // DNA warp bestimmt Richtungen der Wellen
    vec2 wx  = normalize(vec2(1.0,   0.0)  + vec2( u_dna_warp_x,  u_dna_warp_y) * 0.25);
    vec2 wy  = normalize(vec2(0.0,   1.0)  + vec2(-u_dna_warp_y,  u_dna_warp_x) * 0.25);
    vec2 wd1 = normalize(vec2(0.707, 0.707)+ vec2( u_dna_warp_x, -u_dna_warp_y) * 0.2);
    vec2 wd2 = normalize(vec2(-0.707,0.707)+ vec2( u_dna_warp_y,  u_dna_warp_x) * 0.2);

    // ── Wellenakkumulation ─────────────────────────────────
    // n = u_dna_spokes (2.0–10.0, kontinuierlich)
    // Jede Welle i wird mit clamp(n-i, 0,1) sanft ein/ausgeblendet
    float n       = u_dna_spokes;
    float p       = 0.0;
    float total_w = 0.0;
    float w;

    // — Welle 0: Horizontal (DNA-warp-richtung X) — immer aktiv —
    w = 1.0;
    p += w * sin(dot(uv, wx) * bf * 2.0  + tm        + ph * 1.00) * ba;
    total_w += w;

    // — Welle 1: Vertikal (DNA-warp-richtung Y) — ab spokes 2 —
    w = clamp(n - 1.0, 0.0, 1.0);
    p += w * sin(dot(uv, wy) * bf * 1.75 + tm * 0.80 + ph * 1.31) * ba;
    total_w += w;

    // — Welle 2: Diagonal ↗ — ab spokes 3 —
    w = clamp(n - 2.0, 0.0, 1.0);
    p += w * sin(dot(uv, wd1) * bf * 2.3 + tm * 1.20 + ph * 0.71) * ba;
    total_w += w;

    // — Welle 3: Radial (Abstand von DNA-Zentrum) — ab spokes 4 —
    w = clamp(n - 3.0, 0.0, 1.0);
    vec2 c1 = vec2(u_dna_warp_x, u_dna_warp_y) * 0.45;
    p += w * sin(length(uv - c1) * bf * 1.60 + tm * 0.65 + ph * 1.73);
    total_w += w;

    // — Welle 4: Diagonal ↖ — ab spokes 5 —
    w = clamp(n - 4.0, 0.0, 1.0);
    p += w * sin(dot(uv, wd2) * bf * (2.0 + wf) + tm * 1.40 + ph * 2.09) * ba;
    total_w += w;

    // — Welle 5: Zweites Radialzentrum (versetzt) — ab spokes 6 —
    w = clamp(n - 5.0, 0.0, 1.0);
    vec2 c2 = vec2(-u_dna_warp_y, u_dna_warp_x) * 0.35;
    p += w * sin(length(uv + c2) * bf * (1.85 + wf) + tm * 0.90 + ph * 0.43);
    total_w += w;

    // — Welle 6: Angular (Winkelbasiert, erzeugt Strahlen-Muster) — ab spokes 7 —
    w = clamp(n - 6.0, 0.0, 1.0);
    float ang = atan(uv.y, uv.x);
    p += w * sin(ang * (2.5 + u_dna_wave_freq) + length(uv) * bf + tm * 0.50 + ph * 3.00);
    total_w += w;

    // — Welle 7: Kreuzprodukt (nichtlinear, Mandala-artig) — ab spokes 8 —
    w = clamp(n - 7.0, 0.0, 1.0);
    p += w * sin(uv.x * uv.y * bf * 2.8 + tm * 1.10 + ph * 1.94) * ba;
    total_w += w;

    // — Welle 8: Hochfrequenz-Detail (feine Zellstruktur) — ab spokes 9 —
    w = clamp(n - 8.0, 0.0, 1.0);
    float diag30 = dot(uv, vec2(0.866, 0.5));
    p += w * sin(diag30 * bf * 3.2 + tm * 0.75 + ph * 2.55) * ba;
    total_w += w;

    // — Welle 9: Polar-Compound (r × cos θ) — ab spokes 10 —
    w = clamp(n - 9.0, 0.0, 1.0);
    p += w * sin(length(uv) * uv.x * bf * 1.4 + tm * 1.30 + ph * 4.01);
    total_w += w;

    // Normalisieren → plasma ∈ [0, 1]
    p = p / max(total_w, 0.001);
    float plasma = p * 0.5 + 0.5;

    // ── Farbe: HSV-Rainbow (klassisch) ────────────────────
    // Hue aus Plasma-Wert + zeitbasierte Rotation
    float hue = plasma + u_time * 0.07 * u_dna_color_speed + ph / 6.28318;
    // Helligkeit: Basis-Plasma + Energie-Boost
    float brightness = clamp(0.25 + plasma * 0.75 + u_energy * 0.35, 0.0, 1.0);
    vec3 col = hsv2rgb(vec3(fract(hue), 1.0, brightness));

    // Subtiler Palette-Tint (Mitte → mehr Tint, niedrig → pure HSV)
    float tint_strength = u_dna_mid_react * 0.35;
    vec3 pal_tint = pal(fract(plasma * 0.7 + u_time * 0.025 * u_dna_color_speed));
    col = mix(col, col * pal_tint * 2.5, tint_strength);

    // ── Beat Flash ─────────────────────────────────────────
    col += beat_kick * 0.12 * u_pal_highlight * brightness;

    // ── Energie-Puls (globale Helligkeitsschwankung) ───────
    col *= 1.0 + u_energy * 0.45;

    // ── Vignette ───────────────────────────────────────────
    float vig = 1.0 - dot(uv0 * 1.1, uv0 * 1.1);
    col *= clamp(vig, 0.0, 1.0);

    // ── Feedback Composite ─────────────────────────────────
    col = feedback + col;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
