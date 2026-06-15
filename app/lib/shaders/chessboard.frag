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

// Hash pro Kachel (deterministisch aus Zellkoordinate)
float ch(vec2 c, float salt) {
    return fract(sin(dot(c, vec2(127.1, 311.7)) + salt * 74.7) * 43758.5453);
}

vec3 pal(float t) {
    t = clamp(t, 0.0, 1.0);
    if (t < 0.333) return mix(u_pal_shadow,    u_pal_low,       t * 3.0);
    if (t < 0.667) return mix(u_pal_low,        u_pal_high,      (t - 0.333) * 3.0);
    return               mix(u_pal_high,        u_pal_highlight, (t - 0.667) * 3.0);
}

mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

void main() {
    vec2  fc  = FlutterFragCoord().xy;
    vec2  res = vec2(u_width, u_height);
    float asp = u_width / u_height;

    // ── DNA ────────────────────────────────────────────────
    float d_warp    = floor(dna(1.0) * 3.0);          // 0=Boden 1=Fisheye 2=Tuch
    float d_gridx   = floor(dna(2.0) * 10.0) + 5.0;   // 5–14 Spalten
    float d_gridy   = floor(dna(3.0) * 10.0) + 5.0;   // 5–14 Reihen
    float d_skew    = (dna(4.0) - 0.5) * 0.8;          // Gitter-Scherung
    float d_lognon  = dna(5.0);                         // log-/nicht-uniforme Verzerrung
    float d_extr    = dna(6.0);                         // Extrusions-Stärke
    float d_pulse   = dna(7.0);                         // Pulsier-Stärke
    float d_glitch  = dna(8.0);                         // Glitch-Shift-Stärke
    float d_flip    = dna(9.0) > 0.4 ? 1.0 : 0.0;      // Beat-Farb-Flip an/aus
    float d_rotchance = dna(10.0) * 0.18;              // selten: Kachel-Rotation
    float d_colspd  = dna(11.0) * 0.3 + 0.04;
    float d_scroll  = (dna(12.0) - 0.5) * 0.6;          // Gitter-Scroll

    // ── Beat ───────────────────────────────────────────────
    float beat_phase = fract(u_time * max(u_bpm, 60.0) / 60.0);
    float beat       = exp(-beat_phase * 6.0) * smoothstep(0.1, 0.6, u_bass);
    float beatHard   = step(0.5, exp(-beat_phase * 14.0));  // harter On/Off-Puls

    // ── UV / Raum-Verzerrung (Seed wählt) ─────────────────
    vec2 uv_raw = fc / res;
    vec2 p      = (uv_raw - 0.5) * vec2(asp, 1.0);

    // Stereo: linke Hälfte = L, rechte = R
    bool  isLeft   = uv_raw.x < 0.5;
    float chBass   = isLeft ? u_bass_left  : u_bass_right;
    float sideBass = isLeft ? u_bass_left  : u_bass_right;

    vec2 board;
    if (d_warp < 0.5) {
        // Perspektivboden: y → Horizont
        float horizon = 0.5;
        float yy = (uv_raw.y - horizon);
        // unterhalb Horizont = Boden; mappe in perspektivische Tiefe
        float depth = 1.0 / max(abs(yy) * 2.0 + 0.06, 0.06);
        board = vec2((uv_raw.x - 0.5) * depth * asp, depth + u_time * d_scroll);
        // Energy wellt die Bodenfläche
        board.y += sin(board.x * 2.0 + u_time) * u_energy * 0.4;
    } else if (d_warp < 1.5) {
        // Fisheye/Kugel
        float r = length(p);
        float bulge = 1.0 + u_bass * 0.6 + beat * 0.4;
        float theta = atan(p.y, p.x);
        float rr = asin(clamp(r * bulge, 0.0, 1.0)) / (PI * 0.5);
        board = vec2(theta / PI, rr * 2.0 - u_time * d_scroll);
    } else {
        // Flexible Ebene / wehendes Tuch
        board = p * 2.0;
        board.x += sin(board.y * 3.0 + u_time * 1.2) * (0.1 + u_mid * 0.4);
        board.y += cos(board.x * 2.5 - u_time) * (0.1 + u_energy * 0.3);
        board.y += u_time * d_scroll;
    }

    // Scherung + (optional) log-nicht-uniforme Streckung
    board.x += board.y * d_skew;
    board.x = mix(board.x, sign(board.x) * log(1.0 + abs(board.x) * 2.0), d_lognon * 0.6);

    // ── Gitterzellen ───────────────────────────────────────
    vec2 grid = vec2(d_gridx, d_gridy);
    vec2 gp   = board * grid;

    // Glitch: ganze Reihen/Spalten gegeneinander verschieben
    float rowShift = (ch(vec2(0.0, floor(gp.y)), 3.0) - 0.5)
                   * d_glitch * (0.4 + chBass * 1.6) * beatHard;
    gp.x += rowShift;

    vec2 cell = floor(gp);
    vec2 f    = fract(gp);

    // Kachel-Hashes
    float hRot   = ch(cell, 1.0);
    float hBand  = ch(cell, 2.0);                 // welches Frequenzband
    float hPhase = ch(cell, 4.0);

    // Frequenzband-Wahl pro Kachel (Stereo-Kanal-spezifisch)
    float band;
    if (hBand < 0.4)      band = chBass;          // Bass (Stereo-Seite)
    else if (hBand < 0.75) band = u_mid;
    else                   band = u_high;

    // Pulsieren: Kachel wächst/schrumpft mit ihrem Band
    float pulse = (band * d_pulse + beat * 0.3);
    float inset = 0.06 + pulse * 0.30;

    // Seltene Kachel-Rotation
    vec2 fc2 = f - 0.5;
    if (hRot < d_rotchance) {
        float ra = (hRot * 30.0 + u_time * 0.5) ;
        fc2 = rot2(ra) * fc2;
    }

    // Kachel-Maske (Quadrat mit Inset → pulsierende Lücken)
    vec2 q = abs(fc2) - (0.5 - inset);
    float tile = 1.0 - smoothstep(0.0, 0.03, max(q.x, q.y));

    // Extrusion → Helligkeit (3D-EQ-Gefühl: höhere Kachel = heller)
    float height = band * d_extr;

    // ── Schachbrett-Parität ────────────────────────────────
    float parity = mod(cell.x + cell.y, 2.0);
    // Beat-Flip: Parität kippt am harten Beat
    if (d_flip > 0.5) parity = mod(parity + beatHard, 2.0);

    // ── Farbe ──────────────────────────────────────────────
    float baseT = parity > 0.5 ? 0.7 : 0.15;
    float ct    = fract(baseT + height * 0.4 + ch(cell, 5.0) * 0.2
                        + u_time * d_colspd * 0.05);
    vec3  col   = pal(ct);

    // Höhe/Extrusion als Helligkeit, Tile-Maske als Form
    col = col * (0.10 + height * 1.3) * tile;
    // Pulsierende Fugen leuchten schwach
    col += u_pal_low * 0.04 * (1.0 - tile);

    // Beat: Farbakzent auf aktiven Kacheln
    col = mix(col, u_pal_highlight, beat * 0.35 * tile * step(0.3, band));

    // High: Kantenglanz
    col += u_pal_highlight * pow(tile, 8.0) * u_high * 0.4;

    // Vignette
    float vig = 1.0 - smoothstep(0.45, 1.15, length(uv_raw - 0.5) * 2.0);
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

    col = max(col, trail * 0.85);
    col = clamp(col, 0.0, 1.0);

    fragColor = vec4(col, 1.0);
}
