#include <flutter/runtime_effect.glsl>

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
uniform float u_seed;
uniform vec3  u_pal_shadow;
uniform vec3  u_pal_low;
uniform vec3  u_pal_high;
uniform vec3  u_pal_highlight;
uniform float u_fb_zoom;
uniform float u_fb_rotation;
uniform float u_fb_decay;
uniform float u_fb_warp_x;
uniform float u_fb_warp_y;
uniform sampler2D u_prev_frame;

out vec4 fragColor;

const float PI  = 3.14159265;
const float TAU = 6.28318530;

float dna(float salt) {
    float n = fract(u_seed * 5.96046448e-8);
    return fract(sin(n * 92.7463 + salt * 311.7) * 43758.5453);
}

vec3 pal(float t) {
    t = clamp(t, 0.0, 1.0);
    if (t < 0.333) return mix(u_pal_shadow,    u_pal_low,       t * 3.0);
    if (t < 0.667) return mix(u_pal_low,        u_pal_high,      (t - 0.333) * 3.0);
    return               mix(u_pal_high,        u_pal_highlight, (t - 0.667) * 3.0);
}

mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// ── SDF-Primitive ─────────────────────────────────────────
float sdCircle(vec2 p, float r) { return length(p) - r; }

float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdNgon(vec2 p, float r, float n) {
    float a   = atan(p.y, p.x);
    float seg = TAU / n;
    float aa  = mod(a, seg) - seg * 0.5;
    return length(p) * cos(aa) - r * cos(seg * 0.5);
}

float sdStar(vec2 p, float r, float n, float m) {
    // m: Spitzigkeit 0..1
    float a   = atan(p.y, p.x);
    float seg = TAU / n;
    float aa  = mod(a, seg) - seg * 0.5;
    float rr  = r * mix(1.0, 0.4, m) * (1.0 + m * cos(aa * n));
    return length(p) - mix(r, rr, 0.6);
}

float sdRing(vec2 p, float r, float w) {
    return abs(length(p) - r) - w;
}

float sdCross(vec2 p, float r, float w) {
    vec2 q = abs(p);
    return min(max(q.x - w, q.y - r), max(q.y - w, q.x - r));
}

float sdPetal(vec2 p, float r, float n) {
    float a = atan(p.y, p.x);
    float rad = r * (0.5 + 0.5 * abs(sin(a * n * 0.5)));
    return length(p) - rad;
}

// ── 64 Grundformen: 16 Familien × 4 Varianten ─────────────
// Gibt ein Füll-Feld 0..1 zurück (1 = innen/auf der Form).
float baseShape(vec2 p, float id, float edge) {
    float fam  = floor(mod(id, 16.0));
    float var  = floor(id / 16.0);            // 0..3
    float vk   = var * 0.25;                   // 0, .25, .5, .75
    float d;

    if      (fam <  1.0) d = sdCircle(p, 0.35 + vk * 0.25);
    else if (fam <  2.0) d = sdNgon(p, 0.38, 3.0 + var);                  // Polygone 3..6
    else if (fam <  3.0) d = sdNgon(p, 0.38, 6.0 + var * 2.0);            // Polygone 6..12
    else if (fam <  4.0) d = sdStar(p, 0.40, 5.0 + var, 0.55);           // Sterne 5..8
    else if (fam <  5.0) d = sdStar(p, 0.40, 6.0 + var * 2.0, 0.85);     // spitze Sterne
    else if (fam <  6.0) d = sdRing(p, 0.28 + vk * 0.2, 0.04 + vk * 0.05);// Ringe
    else if (fam <  7.0) d = sdBox(p, vec2(0.30 + vk * 0.2, 0.30 - vk * 0.12));
    else if (fam <  8.0) d = sdBox(rot2(PI * 0.25) * p, vec2(0.30, 0.30 - vk * 0.2)); // Rauten
    else if (fam <  9.0) d = sdCross(p, 0.38, 0.08 + vk * 0.08);          // Kreuze
    else if (fam < 10.0) d = sdPetal(p, 0.36, 4.0 + var * 2.0);          // Blüten
    else if (fam < 11.0) d = sdPetal(p, 0.36, 10.0 + var * 2.0);         // dichte Blüten
    else if (fam < 12.0) {                                                 // verschachtelte Ringe
        float r1 = sdRing(p, 0.18, 0.03);
        float r2 = sdRing(p, 0.34 - vk * 0.1, 0.03);
        d = min(r1, r2);
    }
    else if (fam < 13.0) {                                                 // Polygon-Loch
        d = max(sdNgon(p, 0.40, 4.0 + var), -sdNgon(p, 0.22, 4.0 + var));
    }
    else if (fam < 14.0) {                                                 // Stern + Kern
        d = min(sdStar(p, 0.42, 6.0 + var, 0.9), sdCircle(p, 0.10));
    }
    else if (fam < 15.0) {                                                 // gekreuzte Boxen
        float b1 = sdBox(p, vec2(0.40, 0.07 + vk * 0.05));
        float b2 = sdBox(p, vec2(0.07 + vk * 0.05, 0.40));
        d = min(b1, b2);
    }
    else {                                                                 // Wellen-Mandala
        float a = atan(p.y, p.x);
        d = length(p) - (0.30 + 0.08 * sin(a * (4.0 + var * 3.0)));
    }

    return 1.0 - smoothstep(0.0, edge, d);
}

void main() {
    vec2  fc  = FlutterFragCoord().xy;
    vec2  res = vec2(u_width, u_height);
    float asp = u_width / u_height;

    // ── DNA ────────────────────────────────────────────────
    float d_shape  = floor(dna(1.0) * 64.0);           // 0–63 Grundform
    // Glockenverteilte Segmentzahl (Summe 4 Uniforms ≈ Normalverteilung)
    float bell     = (dna(2.0) + dna(3.0) + dna(4.0) + dna(5.0)) * 0.25;
    float d_seg    = floor(mix(3.0, 20.0, bell) + 0.5); // 3–20, glockenverteilt
    float d_rotspd = (dna(6.0) - 0.5) * 0.6;            // Drehrichtung+geschw.
    float d_zoom   = dna(7.0) * 0.8 + 0.7;              // Zoom-Level
    float d_beatfx = floor(dna(8.0) * 3.0);             // 0=Segment 1=Ruck 2=Achse
    float d_colspd = dna(9.0) * 0.4 + 0.05;             // Farb-Cycle
    float d_double = dna(10.0) > 0.5 ? 1.0 : 0.0;       // Double-Fold an/aus

    // ── Beat ───────────────────────────────────────────────
    float beat_phase = fract(u_time * max(u_bpm, 60.0) / 60.0);
    float beat       = exp(-beat_phase * 6.0) * smoothstep(0.1, 0.6, u_bass);

    // ── UV / Polar ─────────────────────────────────────────
    vec2 uv_raw = fc / res;
    vec2 p      = (uv_raw - 0.5) * vec2(asp, 1.0) * 2.0;

    // Stereo: Kaleidoskop-Zentrum verschiebt sich L/R
    p.x -= (u_bass_left - u_bass_right) * 0.25;

    // Energy + Bass-Kick: Atem-Zoom
    p *= d_zoom / (1.0 + u_energy * 0.3 + beat * 0.25);

    float r = length(p);
    float a = atan(p.y, p.x);

    // ── Beat-Effekte (alle drei, Seed wählt) ──────────────
    float seg = d_seg;
    if (d_beatfx < 0.5) {
        // Segmentzahl springt am Beat
        seg = d_seg + floor(beat * d_seg * 0.8);
    }
    float rot = u_time * d_rotspd;
    if (d_beatfx < 1.5 && d_beatfx >= 0.5) {
        // Rotations-Ruck
        rot += beat * 1.2;
    }
    float axis = 0.0;
    if (d_beatfx >= 1.5) {
        // Faltachse verschiebt sich
        axis = beat * 0.6;
    }

    a += rot;

    // ── Kaleidoskop-Faltung ───────────────────────────────
    float segAng = TAU / seg;
    a = mod(a + axis, segAng);
    a = abs(a - segAng * 0.5);                 // Spiegelung im Segment

    // Double-Fold: zweite Spiegelung für komplexere Symmetrie
    if (d_double > 0.5) {
        a = abs(a - segAng * 0.25);
    }

    // Mid: Faltachsen-Wobble
    a += sin(u_time * 1.3 + r * 4.0) * u_mid * 0.12;

    // Zurück in kartesische Koordinaten (gefaltet)
    vec2 kp = vec2(cos(a), sin(a)) * r;

    // ── Grundform sampeln (mit Wiederholung in der Tiefe) ─
    float edge = 0.015 + u_high * 0.02;        // High schärft Kanten
    // leichtes Tiling für reicheres Muster
    vec2 sp = kp * (1.0 + sin(r * 3.0 - u_time) * 0.06);
    float shape  = baseShape(sp, d_shape, edge);
    // zweite, kleinere Instanz für Verschachtelung
    float shape2 = baseShape(kp * 1.8, d_shape, edge) * 0.5;
    float field  = max(shape, shape2);

    // ── Farbe ──────────────────────────────────────────────
    float ct  = fract(field * 0.5 + r * 0.4 + u_time * d_colspd * 0.06 + a * 0.1);
    vec3  col = pal(ct);
    col = col * (0.12 + field * 1.15);

    // Bass-Kick: Farbakzent + Aufblitzen der Kanten
    col = mix(col, u_pal_highlight, beat * 0.4 * field);

    // High: Glanz auf den Formkanten
    col += u_pal_highlight * pow(field, 6.0) * u_high * 0.6;

    // Vignette
    float vig = 1.0 - smoothstep(0.5, 1.3, r);
    col *= vig;

    // ── Feedback / Trails ─────────────────────────────────
    vec2 fb  = uv_raw - 0.5;
    fb      /= u_fb_zoom;
    fb       = rot2(-u_fb_rotation) * fb;
    fb.x    += sin(fb.y * 8.0 + u_time) * u_fb_warp_x;
    fb.y    += cos(fb.x * 8.0 - u_time) * u_fb_warp_y;
    fb      += 0.5;

    vec2  ef    = smoothstep(0.0, 0.04, fb) * (1.0 - smoothstep(0.96, 1.0, fb));
    float efade = ef.x * ef.y;
    vec3  prev  = texture(u_prev_frame, clamp(fb, 0.001, 0.999)).rgb;
    vec3  trail = prev * u_fb_decay * efade;

    col = max(col, trail * 0.9);
    col = clamp(col, 0.0, 1.0);

    fragColor = vec4(col, 1.0);
}
