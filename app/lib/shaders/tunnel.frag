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

// ── DNA from seed ──────────────────────────────────────────
float dna(float salt) {
    float n = fract(u_seed * 5.96046448e-8);
    return fract(sin(n * 92.7463 + salt * 311.7) * 43758.5453);
}

// ── Palette ────────────────────────────────────────────────
vec3 pal(float t) {
    t = clamp(t, 0.0, 1.0);
    if (t < 0.333) return mix(u_pal_shadow,    u_pal_low,       t * 3.0);
    if (t < 0.667) return mix(u_pal_low,        u_pal_high,      (t - 0.333) * 3.0);
    return               mix(u_pal_high,        u_pal_highlight, (t - 0.667) * 3.0);
}

mat2 rot2(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

// Polygon cross-section factor:
// = 1 at vertices, = 1/cos(PI/n) at face midpoints.
// Multiply r by this to normalize polygon → circle.
float poly_factor(float angle, float n) {
    float seg = TAU / n;
    float a   = mod(angle, seg) - seg * 0.5;
    return cos(a) / cos(PI / n);
}

void main() {
    vec2  fc  = FlutterFragCoord().xy;
    vec2  res = vec2(u_width, u_height);
    float asp = u_width / u_height;

    // ── DNA (alle visuellen Parameter aus dem Seed) ────────
    float d_sides   = floor(dna(1.0) * 6.0) + 3.0;   // 3–8 Seiten
    float d_spiral  = (dna(2.0) - 0.5) * 6.0;         // –3 … +3 Drall
    float d_rings   = dna(3.0) * 9.0 + 4.0;           // 4–13 Ring-Frequenz
    float d_pattern = floor(dna(4.0) * 5.0);          // 0–4 Muster-Modus
    float d_dir     = dna(5.0) > 0.5 ? 1.0 : -1.0;   // rein oder raus
    float d_end     = floor(dna(6.0) * 3.0);          // 0=dunkel 1=licht 2=neutral
    float d_colspd  = dna(7.0) * 0.5 + 0.1;           // Farb-Cycle-Speed
    float d_glow    = dna(8.0);                        // 0=neon scharf, 1=soft glow
    float d_warp    = dna(9.0) * 0.2;                  // Wand-Verzerrung
    float d_pmix    = dna(10.0) * 0.6 + 0.35;         // Polygon-Stärke 0.35–0.95

    // ── Stereo: Fluchtpunkt verschiebt sich L/R ────────────
    float span   = u_bass_left - u_bass_right;          // –1 … +1
    vec2  vp_off = vec2(span * 0.22, 0.0);

    // ── UV zentriert, Aspektverhältnis korrigiert ──────────
    vec2 uv_raw = fc / res;
    vec2 p      = (uv_raw - 0.5) * vec2(asp, 1.0);
    p          -= vp_off * asp;

    // ── Bassdrum-Kick: Tunnel weitet sich ─────────────────
    float kick = smoothstep(0.25, 1.0, u_bass);
    p /= (1.0 + kick * 0.38);

    // ── Polar-Koordinaten ──────────────────────────────────
    float r     = length(p);
    float angle = atan(p.y, p.x);

    // Polygon-Querschnitt: r_eff folgt der Polygon-Grenze
    float pf    = mix(1.0, poly_factor(angle, d_sides), d_pmix);
    float r_eff = r * pf;

    // ── Tiefe (perspektivische Projektion) ─────────────────
    const float FOCAL = 0.35;
    float depth = FOCAL / max(r_eff, 0.012);

    // Geschwindigkeit = Energy, Richtung = DNA
    float speed = (0.45 + u_energy * 2.0) * d_dir;
    float z     = depth + u_time * speed;

    // Spirale: Winkelversatz wächst mit Tiefe
    float spiral_a = angle + d_spiral * depth * 0.04;

    // Mid-getriebene Wand-Verzerrung
    float warp = sin(spiral_a * 3.1 + z * 0.9) * d_warp * (0.2 + u_mid * 0.8);
    float z_w  = z + warp;

    // ── 5 Muster-Modi (durch DNA gewählt) ─────────────────
    float pat;
    if (d_pattern < 0.5) {
        // Ringe
        pat = sin(z_w * d_rings) * 0.5 + 0.5;

    } else if (d_pattern < 1.5) {
        // Ringe × Speichen (Gitter)
        float rv = sin(z_w * d_rings);
        float sv = sin(spiral_a * d_sides);
        pat = (rv * 0.6 + sv * 0.4) * 0.5 + 0.5;

    } else if (d_pattern < 2.5) {
        // Harte Kanten / Wireframe
        float rv = abs(sin(z_w * d_rings));
        float sv = abs(sin(spiral_a * d_sides * 0.5));
        pat = 1.0 - smoothstep(0.0, 0.15, min(rv, sv));

    } else if (d_pattern < 3.5) {
        // Rauten / Schachbrett
        float rv = sin(z_w * d_rings);
        float sv = sin(spiral_a * d_sides);
        pat = sin(rv * 3.0 + sv * 3.0) * 0.5 + 0.5;

    } else {
        // Organisch – verschachtelte Wellen
        float a1 = sin(z_w * d_rings        + spiral_a * d_sides * 0.7);
        float a2 = cos(z_w * d_rings * 0.5  + spiral_a * d_sides * 1.3 + 1.2);
        pat = sin(a1 + a2) * 0.5 + 0.5;
    }

    // High-Band: Feindetail
    pat = mix(pat,
              sin(z_w * d_rings * 2.1 + spiral_a * d_sides * 1.4) * 0.5 + 0.5,
              u_high * 0.3);

    // ── Farbe aus Palette ─────────────────────────────────
    float depth_t = clamp(depth / 18.0, 0.0, 1.0);   // 0=fern, 1=nah
    float col_t   = fract(pat * 0.6 + depth_t * 0.3 + u_time * d_colspd * 0.06);
    vec3  col     = pal(col_t);

    // Neon (scharfe Linien) ↔ Soft (Glow)
    float sharp = mix(11.0, 2.0, d_glow);
    float ambnt = mix(0.06, 0.28, d_glow);
    col = col * ambnt + col * pow(pat, sharp);

    // ── Tunnel-Ende (dunkel / Licht / neutral) ────────────
    float core = 1.0 - smoothstep(0.0, 0.06, r_eff);
    vec3  end_col;
    if (d_end < 0.5) {
        end_col = vec3(0.0);
    } else if (d_end < 1.5) {
        end_col = u_pal_highlight * (1.8 + u_energy * 2.5);
    } else {
        end_col = pal(fract(u_time * 0.04 + 0.6));
    }
    col = mix(col, end_col, core);

    // ── Bassdrum: Farb-Flash ───────────────────────────────
    col = mix(col, u_pal_highlight, kick * 0.38);

    // ── Tiefennebel (ferne Stellen → Shadow-Farbe) ────────
    float fog = 1.0 - smoothstep(0.05, 0.75, depth_t);
    col = mix(u_pal_shadow * 0.04, col, fog * 0.65 + 0.35);

    // ── Vignette ──────────────────────────────────────────
    float vig = 1.0 - smoothstep(0.35, 0.9, length(uv_raw - 0.5) * 2.0);
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

    // Neon → max-Blend (harte Trails), Soft → additiv (Glow-Echo)
    col = mix(max(col, trail * 0.9), col + trail * 0.45, d_glow);
    col = clamp(col, 0.0, 1.0);

    fragColor = vec4(col, 1.0);
}
