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

const float PI  = 3.14159265359;
const float TAU = 6.28318530718;

float dna(float salt) {
    return fract(sin(salt * 92.7463 + u_seed * 13.37) * 43758.5453);
}

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

vec3 get_palette(float t) {
    t = fract(t);
    vec3 col = mix(u_pal_shadow, u_pal_low, smoothstep(0.0, 0.33, t));
    col = mix(col, u_pal_high, smoothstep(0.33, 0.66, t));
    col = mix(col, u_pal_highlight, smoothstep(0.66, 1.0, t));
    return col;
}

mat2 rot2(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

// ── Komplexes, mehrschichtiges Grundmuster ─────────────────
// Liefert ein dichtes Mandala-Feld. style_id wählt den Charakter,
// die Schichten werden immer überlagert -> hohe visuelle Komplexität.
float pattern_field(vec2 p, float style_id) {
    float r = length(p);
    float a = atan(p.y, p.x);

    // Schicht A: konzentrische, audio-getriebene Wellenringe
    float layA = sin(r * (18.0 + u_mid * 20.0) - u_time * 2.0);

    // Schicht B: radiale Blütenblätter (Anzahl aus style)
    float petals = 5.0 + floor(style_id) * 2.0;
    float layB = sin(a * petals + sin(r * 6.0 - u_time) * 2.0);

    // Schicht C: feines, gedrehtes Gitter (intrikate Textur)
    vec2 gp = rot2(u_time * 0.1) * p * (10.0 + u_high * 14.0);
    float layC = sin(gp.x) * sin(gp.y);

    // Schicht D: hypnotische Spirale
    float layD = sin(r * 22.0 - a * (3.0 + floor(style_id)) - u_time * 3.0);

    // Schicht E: zellige Substruktur (Voronoi-artig, billig)
    vec2 cell = floor(p * 8.0);
    float layE = hash21(cell + floor(u_time));
    layE = smoothstep(0.3, 0.9, layE) * exp(-r * 1.5);

    // style_id mischt die Gewichte -> jeder Seed ein anderer Charakter
    float w0 = 0.6 + 0.4 * sin(style_id * 1.7);
    float w1 = 0.6 + 0.4 * cos(style_id * 2.3);
    float w2 = 0.5 + 0.5 * sin(style_id * 3.1 + 1.0);

    float field = layA * w0
                + layB * w1 * 0.8
                + layC * 0.4
                + layD * w2 * 0.7
                + layE * 1.2;

    return field;
}

void main() {
    vec2 fc = FlutterFragCoord().xy;
    vec2 res = vec2(u_width, u_height);
    vec2 uv_raw = fc / res;

    vec2 uv = (fc - res * 0.5) / min(u_width, u_height);

    // ── 1. GENETIK ─────────────────────────────────────────
    // Symmetrie glockenverteilt (Summe mehrerer dna-Samples ≈ Normalverteilung)
    float bell = (dna(1.0) + dna(2.0) + dna(3.0) + dna(4.0)) * 0.25;
    float d_symmetry = floor(mix(4.0, 18.0, bell) + 0.5);
    float d_style    = dna(5.0) * 8.0;          // Muster-Charakter
    float d_rotspd   = (dna(6.0) - 0.5) * 1.4;  // Drehrichtung/-tempo
    float d_colshift = dna(7.0) * 2.0;
    float d_nested   = dna(8.0) > 0.45 ? 1.0 : 0.0;  // zweite Faltung
    float d_beatfx   = floor(dna(9.0) * 3.0);   // 0=Segment 1=Ruck 2=Achse

    // ── 2. BEAT & AUDIO ────────────────────────────────────
    float beat_phase = fract(u_time * (max(u_bpm, 60.0) / 60.0));
    float beat_pulse = exp(-beat_phase * 6.0) * smoothstep(0.1, 0.6, u_bass);

    // Stereo verschiebt das Zentrum
    vec2 center = vec2((u_bass_left - u_bass_right) * 0.18, 0.0);
    uv -= center;

    // Energie-Atem
    uv *= 1.0 - u_energy * 0.12 - beat_pulse * 0.08;

    // ── 3. KALEIDOSKOP-FALTUNG ─────────────────────────────
    float r = length(uv);
    float a = atan(uv.y, uv.x);

    // Grund-Rotation
    a += u_time * d_rotspd * (0.4 + u_energy * 0.6);

    // Beat-Effekte (Seed wählt einen)
    float symmetry = d_symmetry;
    if (d_beatfx < 0.5) {
        symmetry += floor(beat_pulse * d_symmetry * 0.6);   // Segmentzahl springt
    } else if (d_beatfx < 1.5) {
        a += beat_pulse * 1.0;                               // Rotations-Ruck
    } else {
        a += beat_pulse * sin(r * 18.0) * 0.25;             // Faltachse bricht auf
    }

    // Polar-Fold
    float seg = TAU / symmetry;
    a = mod(a, seg);
    a = abs(a - seg * 0.5);

    // Verschachtelte zweite Faltung -> dichtere Mandalas
    if (d_nested > 0.5) {
        a = abs(a - seg * 0.25);
    }

    // Mid-Wobble auf dem Radius
    float rr = r + sin(a * 6.0 + u_time * 1.5) * u_mid * 0.04;

    vec2 folded = rr * vec2(cos(a), sin(a));

    // ── 4. MUSTER & FARBE ──────────────────────────────────
    float field = pattern_field(folded, d_style);

    // High schärft die Kanten
    float sharp = 0.35 + u_high * 0.6;
    float m = smoothstep(-sharp, sharp, field);

    // Farbkoordinate: Tiefe + Muster + Takt + Stereo
    float color_t = r * 1.3 - u_time * 0.15 + d_colshift + m * 0.4
                  + beat_pulse * 0.4;
    vec3 col = get_palette(color_t);

    // Helligkeit: Muster moduliert, Audio hebt an
    col *= (0.25 + m * 0.9) * (0.6 + u_energy * 0.5 + beat_pulse * 0.9);

    // Glanzkanten auf den Mustergraten
    col += u_pal_highlight * pow(m, 8.0) * (0.3 + u_high * 0.7);

    // Zentrum weich, Vignette
    col *= smoothstep(0.0, 0.08, r);
    col *= smoothstep(1.25, 0.35, r);

    // ── 5. FEEDBACK STATE ──────────────────────────────────
    vec2 fb_uv = uv_raw;
    vec2 zoom_center = vec2(0.5) + center * 0.5 * (u_height / u_width);

    fb_uv = (fb_uv - zoom_center) * (1.0 / u_fb_zoom) + zoom_center;
    fb_uv -= zoom_center;
    fb_uv = rot2(u_fb_rotation) * fb_uv;
    fb_uv += zoom_center;

    fb_uv.x += sin(fb_uv.y * 10.0 + u_time) * u_fb_warp_x * (0.5 + u_mid);
    fb_uv.y += cos(fb_uv.x * 10.0 - u_time) * u_fb_warp_y * (0.5 + u_mid);

    vec3 prev_col = texture(u_prev_frame, clamp(fb_uv, 0.001, 0.999)).rgb;
    prev_col *= u_fb_decay;

    // Max-Blend für kristalline, scharfe Spuren
    col = max(col, prev_col * (0.78 + u_high * 0.2));

    // Tonemapping
    col = 1.0 - exp(-col);
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
