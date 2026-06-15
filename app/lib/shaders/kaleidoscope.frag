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

// u_seed in [0,1) -> GPU-sichere sin()-Argumente.
float dna(float salt) {
    return fract(sin(salt * 78.233 + u_seed * 113.5) * 43758.5453);
}

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
vec2 hash22(vec2 p) {
    float n = sin(dot(p, vec2(41.0, 289.0)));
    return fract(vec2(262144.0, 32768.0) * n);
}
float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
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

// Animiertes Voronoi: x=Zell-ID, y=Aderdistanz, z=Kerndistanz
vec3 voronoi(vec2 x, float drift) {
    vec2 n = floor(x), f = fract(x);
    vec2 mg = vec2(0.0), mr = vec2(0.0);
    float md = 8.0, mid = 0.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash22(n + g);
            o = 0.5 + 0.5 * sin(u_time * 0.5 + TAU * o + drift);
            vec2 r = g + o - f;
            float d = dot(r, r);
            if (d < md) { md = d; mr = r; mg = g; mid = hash21(n + g); }
        }
    }
    float mdist = 8.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = mg + vec2(float(i), float(j));
            vec2 o = hash22(n + g);
            o = 0.5 + 0.5 * sin(u_time * 0.5 + TAU * o + drift);
            vec2 r = g + o - f;
            vec2 diff = r - mr;
            if (dot(diff, diff) > 0.0001) {
                mdist = min(mdist, dot(0.5 * (mr + r), normalize(diff)));
            }
        }
    }
    return vec3(mid, mdist, sqrt(md));
}

void main() {
    vec2 fc  = FlutterFragCoord().xy;
    vec2 res = vec2(u_width, u_height);
    vec2 uv_raw = fc / res;
    vec2 uv = (fc - res * 0.5) / min(u_width, u_height);

    // ── 1. GENETIK ─────────────────────────────────────────
    float bell = (dna(1.0) + dna(2.0) + dna(3.0) + dna(4.0)) * 0.25;
    float d_sym     = floor(mix(4.0, 16.0, bell) + 0.5);
    float d_density = dna(5.0) * 3.0 + 2.0;
    float d_rotspd  = (dna(6.0) - 0.5) * 1.2;
    float d_colshift= dna(7.0);
    float d_nested  = dna(8.0) > 0.45 ? 1.0 : 0.0;
    float d_beatfx  = floor(dna(9.0) * 3.0);
    float d_palspd  = dna(10.0) * 0.1 + 0.02;
    float d_zoomdr  = (dna(11.0) - 0.5) * 0.3;
    float d_warpamt = dna(12.0) * 0.25;            // organische Verzerrung
    float d_rings   = floor(dna(13.0) * 5.0) + 3.0; // konzentrische Ringe

    // ── 2. BEAT & AUDIO ────────────────────────────────────
    float beat_phase = fract(u_time * (max(u_bpm, 60.0) / 60.0));
    float beat = exp(-beat_phase * 6.0) * smoothstep(0.1, 0.6, u_bass);

    vec2 center = vec2((u_bass_left - u_bass_right) * 0.18, 0.0);
    uv -= center;
    uv *= 1.0 - u_energy * 0.12 - beat * 0.08;
    uv *= 1.0 + sin(u_time * d_zoomdr) * 0.15;

    // ── 3. KALEIDOSKOP-FALTUNG ─────────────────────────────
    float r = length(uv);
    float a = atan(uv.y, uv.x);
    a += u_time * d_rotspd * (0.4 + u_energy * 0.6);

    float sym = d_sym;
    if (d_beatfx < 0.5)      sym += floor(beat * d_sym * 0.5);
    else if (d_beatfx < 1.5) a += beat * 0.9;
    else                     a += beat * sin(r * 16.0) * 0.22;

    float seg = TAU / sym;
    a = mod(a, seg);
    a = abs(a - seg * 0.5);
    if (d_nested > 0.5) a = abs(a - seg * 0.25);

    vec2 folded = r * vec2(cos(a), sin(a));

    // Organische Domain-Warp-Verzerrung (Mitten treiben sie)
    float wn = vnoise(folded * 3.0 + u_time * 0.2);
    folded += (wn - 0.5) * d_warpamt * (0.5 + u_mid);

    // ── 4. GLASPERLEN-FELD ─────────────────────────────────
    float drift = u_bass * 2.5 + u_mid * 1.0;
    vec3 vor = voronoi(folded * d_density, drift);
    float cellId   = vor.x;
    float edge     = vor.y;
    float coreDist = vor.z;

    float band = (cellId < 0.34) ? u_bass : (cellId < 0.7) ? u_mid : u_high;

    // Konzentrische Ringstruktur (zusätzliche Komplexität)
    float rings = 0.5 + 0.5 * sin(r * d_rings * PI - u_time * 1.5 + cellId * TAU);

    // ── 5. FARBE ───────────────────────────────────────────
    float ct = fract(cellId + d_colshift + r * 0.25 + u_time * d_palspd
                     + beat * 0.3 + rings * 0.12);
    vec3 cell_col = get_palette(ct);

    // Adern (Glasstege)
    float vein = smoothstep(0.0, 0.05, edge);
    vec3 col = cell_col * (0.18 + 0.82 * vein);

    // 3D-Glasperlen-Shading: Kern hell, mit Falsch-Glanzlicht
    float bead = 1.0 - coreDist;
    col *= 0.5 + bead * 0.7 + band * 0.8 + beat * 0.5;
    col += cell_col * pow(bead, 3.0) * 0.5;           // innerer Lichtkern
    col *= 0.7 + rings * 0.5;                          // Ringmodulation

    // Glühende Adern + kristalline Schärfung
    col += u_pal_highlight * (1.0 - vein) * (0.35 + u_high * 1.2 + beat * 0.6);
    col += u_pal_high * pow(1.0 - vein, 4.0) * u_high * 0.5;

    // Feines Sparkle-Detail in den Zellen
    float spark = hash21(floor(folded * d_density * 4.0) + floor(u_time * 6.0));
    col += u_pal_highlight * step(0.97, spark) * vein * (0.3 + u_high);

    // Rotierender Lichtschweif (sweep)
    float sweep = smoothstep(0.6, 1.0, sin(a * 3.0 - u_time * 1.2) * 0.5 + 0.5);
    col += cell_col * sweep * 0.15 * vein;

    // Zentrum weich, Vignette
    col *= smoothstep(0.0, 0.06, r);
    col *= smoothstep(1.25, 0.3, r);

    // ── 6. FEEDBACK (mit chromatischer Aberration) ─────────
    vec2 fb_uv = uv_raw;
    vec2 zoom_center = vec2(0.5) + center * 0.5 * (u_height / u_width);
    fb_uv = (fb_uv - zoom_center) * (1.0 / u_fb_zoom) + zoom_center;
    fb_uv -= zoom_center;
    fb_uv = rot2(u_fb_rotation) * fb_uv;
    fb_uv += zoom_center;
    fb_uv.x += sin(fb_uv.y * 10.0 + u_time) * u_fb_warp_x * (0.5 + u_mid);
    fb_uv.y += cos(fb_uv.x * 10.0 - u_time) * u_fb_warp_y * (0.5 + u_mid);

    vec2 caDir = uv_raw - 0.5;
    float ca = 0.0015 + u_high * 0.004;
    vec3 prev;
    prev.r = texture(u_prev_frame, clamp(fb_uv + caDir * ca, 0.001, 0.999)).r;
    prev.g = texture(u_prev_frame, clamp(fb_uv,              0.001, 0.999)).g;
    prev.b = texture(u_prev_frame, clamp(fb_uv - caDir * ca, 0.001, 0.999)).b;
    prev *= u_fb_decay;

    col = max(col, prev * (0.78 + u_high * 0.2));

    col = 1.0 - exp(-col);
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
