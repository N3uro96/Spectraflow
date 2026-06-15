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
    t = clamp(t, 0.0, 1.0);
    vec3 col = mix(u_pal_shadow, u_pal_low, smoothstep(0.0, 0.33, t));
    col = mix(col, u_pal_high, smoothstep(0.33, 0.66, t));
    col = mix(col, u_pal_highlight, smoothstep(0.66, 1.0, t));
    return col;
}

mat2 rot2(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

void main() {
    vec2 fc  = FlutterFragCoord().xy;
    vec2 res = vec2(u_width, u_height);
    vec2 uv_raw = fc / res;
    vec2 p = (fc - res * 0.5) / min(u_width, u_height);

    // ── 1. DNA ──────────────────────────────────────────────
    float d_dir      = dna(1.0) > 0.5 ? 1.0 : -1.0;      // rein / raus
    float d_shapeamp = dna(2.0) * 0.28;                  // Querschnitt-Verformung
    float d_sides    = floor(dna(3.0) * 5.0) + 3.0;      // 3–7 Ecken
    float d_sharp    = dna(4.0);                         // rund -> sternig
    float d_segments = floor(dna(5.0) * 6.0) + 2.0;      // Winkel-Spiegelsegmente
    float d_panels   = floor(dna(6.0) * 4.0) + 3.0;      // Panels pro Segment
    float d_ringfreq = floor(dna(7.0) * 4.0) + 2.0;      // Dichte entlang der Tiefe
    float d_twist    = (dna(8.0) - 0.5) * 3.0;           // Spiral-Verdrehung
    float d_end      = floor(dna(9.0) * 3.0);            // Ende: dunkel/hell/neutral
    float d_palspd   = dna(10.0) * 0.15 + 0.03;
    float d_brick    = dna(11.0) > 0.5 ? 1.0 : 0.0;      // versetzte Reihen

    // ── 2. PERSPEKTIVE & STEREO ────────────────────────────
    float pshift = (u_bass_left - u_bass_right) * 0.12;  // sanfte Fluchtpunkt-Wanderung
    p.x -= pshift;

    float r = length(p);
    float a = atan(p.y, p.x);

    // Querschnittsform deformieren (Polygon/Stern, von Mitten vibriert)
    float shapeMod = cos(a * d_sides);
    shapeMod = mix(shapeMod, abs(shapeMod) * 2.0 - 1.0, d_sharp);
    r *= 1.0 + d_shapeamp * shapeMod * (0.6 + u_mid * 0.8);

    // ── 3. TIEFE & FLUSS (gleichmäßiger Sog) ───────────────
    float depth = 1.0 / (r + 0.05);
    float speed = 0.5 + (u_bpm / 60.0) * 0.35 + u_energy * 1.6;
    float beat  = exp(-fract(u_time * (max(u_bpm, 60.0) / 60.0)) * 5.0)
                * smoothstep(0.2, 0.7, u_bass);

    // Tiefen-Koordinate; Bass-Punch lässt den Tunnel kurz nach vorn springen
    float v = depth * d_ringfreq + u_time * speed * d_dir + beat * 0.4 * d_dir;

    // ── 4. WAND-GEOMETRIE (gefaltete Panels + Twist) ───────
    float seg = TAU / d_segments;
    float aa  = mod(a, seg);
    aa = abs(aa - seg * 0.5);          // Spiegelung -> Kaleidoskop-Wände
    aa += depth * d_twist * 0.15;       // mit der Tiefe verdrehen -> Spirale

    float u = aa / seg * d_panels;      // Panels rund um das Segment
    float w = v;

    // versetzte Reihen (Ziegelmuster)
    u += (d_brick > 0.5) ? mod(floor(w), 2.0) * 0.5 : 0.0;

    vec2 cell = vec2(u, w);
    vec2 cid  = floor(cell);
    vec2 cf   = fract(cell);

    // Pro Panel ein Hash -> Frequenzband zuordnen
    float h = hash21(cid + vec2(d_segments, d_panels));
    float band = (h < 0.34) ? u_bass : (h < 0.7) ? u_mid : u_high;

    // Leuchtende Fugen (Grid-Linien) + Panel-Füllung
    vec2 edge = min(cf, 1.0 - cf);
    float grout = 1.0 - smoothstep(0.0, 0.06, min(edge.x, edge.y));
    float panel = smoothstep(0.5, 0.42, max(abs(cf.x - 0.5), abs(cf.y - 0.5)));

    // Feine Wand-Textur
    float det = vnoise(vec2(u * 2.0, w * 3.0) + u_time * 0.2);

    // ── 5. FARBE ───────────────────────────────────────────
    float ct = fract(w * 0.12 + u_time * d_palspd + h * 0.15);
    vec3 wall = get_palette(ct);

    vec3 col = wall * (0.12 + det * 0.15);                       // dunkle Basis + Textur
    col += wall * panel * (0.25 + band * 1.2 + beat * 0.5);      // beleuchtete Panels (Audio)
    col += u_pal_highlight * grout * (0.5 + u_high * 1.5 + beat * 0.8); // glühende Fugen
    col += u_pal_highlight * beat * 0.4;                         // Bass-Farbblitz

    // ── 6. TUNNEL-ENDE + NEBEL ─────────────────────────────
    float fog = smoothstep(6.0, 26.0, depth);  // Richtung Fluchtpunkt
    vec3 end_col;
    if (d_end < 0.5) {
        end_col = u_pal_shadow * 0.05;                 // Dunkelheit
    } else if (d_end < 1.5) {
        end_col = u_pal_highlight * (1.2 + u_energy * 2.5); // gleißendes Licht
    } else {
        end_col = get_palette(fract(u_time * 0.08));   // neutral, rotierend
    }
    col = mix(col, end_col, fog);

    // Kern-Glühen
    float core = smoothstep(0.35, 0.0, r);
    col += end_col * core * (0.3 + u_energy * 0.5);

    // Stereo L/R Helligkeits-Akzente
    float lr = (uv_raw.x < 0.5) ? u_bass_left : u_bass_right;
    col *= 0.85 + lr * 0.4;

    // Vignette
    col *= smoothstep(1.25, 0.25, length(uv_raw - 0.5) * 2.0);

    // ── 7. FEEDBACK + CHROMATISCHE ABERRATION ──────────────
    vec2 zc = vec2(0.5 + pshift * 0.5 * (u_height / u_width), 0.5);
    vec2 fb = (uv_raw - zc) * (1.0 / u_fb_zoom) + zc;
    fb -= zc;
    fb = rot2(u_fb_rotation) * fb;
    fb += zc;
    fb.x += sin(fb.y * 10.0 + u_time) * u_fb_warp_x * (0.2 + u_high);
    fb.y += cos(fb.x * 10.0 - u_time) * u_fb_warp_y * (0.2 + u_mid);

    vec2 caDir = uv_raw - 0.5;
    float ca = 0.002 + u_energy * 0.004;
    vec3 prev;
    prev.r = texture(u_prev_frame, clamp(fb + caDir * ca, 0.001, 0.999)).r;
    prev.g = texture(u_prev_frame, clamp(fb,               0.001, 0.999)).g;
    prev.b = texture(u_prev_frame, clamp(fb - caDir * ca, 0.001, 0.999)).b;
    prev *= u_fb_decay;

    float trail_strength = 0.5 + u_energy * 0.5;
    col = col + prev * trail_strength;

    // Tonemapping gegen Clipping
    col = 1.0 - exp(-col);
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
