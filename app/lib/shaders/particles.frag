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

// Partikel-lokaler Hash (von ID und Salt)
float ph(float id, float salt) {
    return fract(sin(id * 127.1 + salt * 311.7) * 43758.5453);
}

// Globale DNA aus Seed
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

// ── 8 Partikel-Typen ──────────────────────────────────────
// d  = Fragment-Offset vom Partikel-Zentrum (Screen-Space)
// sz = Screen-Space Radius des Partikels
// vd = normalisierte Geschwindigkeitsrichtung
float particle_shape(vec2 d, float type, float sz, vec2 vd) {
    float r = length(d) / max(sz, 1e-5);

    if (type < 0.5) {
        // 0 – Punkt: weicher Gauss-Dot
        return exp(-r * r * 3.0);
    }
    if (type < 1.5) {
        // 1 – Stern: 4-Punkt-Kreuz mit Zentralkern
        float cx = exp(-(d.y/sz)*(d.y/sz) * 18.0) * exp(-(d.x/sz)*(d.x/sz) * 0.4);
        float cy = exp(-(d.x/sz)*(d.x/sz) * 18.0) * exp(-(d.y/sz)*(d.y/sz) * 0.4);
        return max(cx, cy) + exp(-r * r * 9.0) * 0.5;
    }
    if (type < 2.5) {
        // 2 – Linie: gestreckte Ellipse in Bewegungsrichtung
        vec2 vp    = vec2(-vd.y, vd.x);
        float a_v  = dot(d, vd)  / (sz * 2.8);
        float a_p  = dot(d, vp)  / (sz * 0.32);
        return exp(-(a_v * a_v + a_p * a_p) * 2.2);
    }
    if (type < 3.5) {
        // 3 – Ring: expandierender hohler Kreis
        return exp(-pow(r - 0.65, 2.0) * 20.0);
    }
    if (type < 4.5) {
        // 4 – Blob: organisch weich (Metaball-artiger Falloff)
        float v = max(0.0, 1.0 - r * r);
        return v * v * v * 1.5;
    }
    if (type < 5.5) {
        // 5 – Pixel: hartes Rechteck (Anti-Alias via smoothstep)
        float sq = max(abs(d.x), abs(d.y)) / sz;
        return smoothstep(0.85, 0.65, sq);
    }
    if (type < 6.5) {
        // 6 – Funken: heller Kern + langer Schweif
        float along_f = max(0.0,  dot(d,  vd)) / sz;   // vor dem Partikel
        float along_b = max(0.0,  dot(d, -vd)) / sz;   // hinter dem Partikel (Schweif)
        float perp    = length(d - dot(d, vd) * vd) / sz;
        float core    = exp(-along_f * 3.5 - perp * perp * 9.0 - along_b * 9.0);
        float tail    = exp(-along_b * 1.3 - perp * perp * 14.0);
        return max(core, tail * 0.55);
    }
    // 7 – Kristall: 6-fache Symmetrie (Schneeflocke)
    float ha = mod(atan(d.y, d.x), PI / 3.0);               // Sektor [0, PI/3)
    float arm = 1.0 - min(ha, PI / 3.0 - ha) / (PI / 6.0); // 1 an Armen, 0 zwischen
    return exp(-r * r * 1.2) * (0.15 + arm * 2.8 * exp(-r * r * 7.0));
}

void main() {
    vec2  fc  = FlutterFragCoord().xy;
    vec2  res = vec2(u_width, u_height);
    float asp = u_width / u_height;

    // ── DNA ────────────────────────────────────────────────
    float d_type_a   = floor(dna(1.0) * 8.0);         // primärer Typ 0–7
    float d_type_b   = floor(dna(2.0) * 8.0);         // sekundärer Typ 0–7
    float d_count    = floor(dna(3.0) * 33.0) + 32.0; // 32–64 aktive Partikel
    float d_scale    = dna(4.0) * 0.55 + 0.25;        // Orbit-Radius Skala
    float d_behavior = dna(5.0);                       // 0=eng, 1=ausladend
    float d_speed    = dna(6.0) * 1.6 + 0.4;          // Basis-Rotationsgeschw.
    float d_size     = dna(7.0) * 0.038 + 0.018;      // Partikel-Weltgröße
    float d_clrdrift = dna(8.0) * 0.35 + 0.05;        // Farb-Drift
    float d_z_range  = dna(9.0) * 1.8 + 0.6;          // Z-Tiefenbereich
    float d_tilt     = dna(10.0) * 0.55;               // Orbit-Neigung

    // ── Stereo: Partikelfeld-Versatz ──────────────────────
    float stereo_push = (u_bass_left - u_bass_right) * 0.3;

    // ── Beat-Gravitation ───────────────────────────────────
    float beat_phase = fract(u_time * max(u_bpm, 60.0) / 60.0);
    // Kurzer scharfer Pull am Beat-Beginn, danach exponentiell abklingend
    float beat_pull  = exp(-beat_phase * 5.5) * u_bass;

    // ── Energy → globale Geschwindigkeit ──────────────────
    float speed_mod = 1.0 + u_energy * 2.0;

    // ── Fragment-Position in Weltkoordinaten ───────────────
    vec2 uv_raw = fc / res;
    vec2 fp     = (uv_raw - 0.5) * vec2(asp, 1.0) * 2.0;

    // ── Akkumuliertes Licht ────────────────────────────────
    vec3 col = u_pal_shadow * 0.025;

    for (int i = 0; i < 64; i++) {
        if (float(i) >= d_count) break;
        float id = float(i);

        // Orbit-Parameter determinisch aus Partikel-ID
        float orbit_r   = (ph(id, 1.0) * 0.55 + 0.2) * d_scale;
        float orbit_spd = (ph(id, 2.0) - 0.5) * 2.0 * d_speed;
        float orbit_off = ph(id, 3.0) * TAU;
        float z_base    = ph(id, 5.0) * d_z_range + 0.5;
        float z_spd     = (ph(id, 6.0) - 0.5) * 0.45;
        float p_hue     = ph(id, 7.0);
        float p_sz_mod  = ph(id, 8.0) * 0.55 + 0.7;
        float p_type    = ph(id, 9.0) > 0.62 ? d_type_b : d_type_a;

        // 3D Position (Kreisbahn + Z-Oszillation)
        float theta  = orbit_off + u_time * orbit_spd * speed_mod;
        float r_live = orbit_r * (1.0 + u_energy * mix(0.25, 0.75, d_behavior));
        float px     = cos(theta) * r_live;
        float py     = sin(theta) * r_live * (0.6 + d_tilt * 0.4);
        float pz     = z_base + sin(u_time * z_spd + orbit_off) * 0.45;

        // Beat-Gravitation: Partikel werden zum Zentrum gesaugt
        float pull   = beat_pull * 0.85;
        px = mix(px, px * 0.04, pull);
        py = mix(py, py * 0.04, pull);

        // Stereo-Feld: L-dominante Sounds → Partikel nach links
        px += stereo_push;

        // Mid: sanfte seitliche Wellenbewegung
        px += sin(u_time * 0.75 + orbit_off) * u_mid * 0.12;
        py += cos(u_time * 0.63 + orbit_off * 1.3) * u_mid * 0.08;

        // Perspektiv-Projektion
        float pz_s   = max(pz, 0.12);
        vec2  screen = vec2(px, py) / pz_s;
        float p_sz   = d_size * p_sz_mod / pz_s;

        // Frühes Abbruch-Kriterium (kein Fragment-Beitrag → überspringen)
        vec2  dvec = fp - screen;
        if (length(dvec) > p_sz * 4.5) continue;

        // Geschwindigkeitsrichtung (Tangente der Kreisbahn)
        vec2 vd = normalize(vec2(-sin(theta), cos(theta)) * sign(orbit_spd)
                          + vec2(0.0001, 0.0));

        float contrib = particle_shape(dvec, p_type, p_sz, vd);
        if (contrib < 0.002) continue;

        // Farbe: Palette + Tiefen-Versatz + Zeitdrift
        float depth_t = 1.0 - clamp(pz / (d_z_range + 0.5), 0.0, 1.0);
        float ct      = fract(p_hue + depth_t * 0.35 + u_time * d_clrdrift * 0.04);
        vec3  pcol    = pal(ct);

        // Helligkeit: näher = heller; Bass-Kick verstärkt kurz
        float bright  = (1.4 / pz_s) * (0.8 + u_energy * 0.5 + beat_pull * 0.6);
        col += pcol * contrib * bright;
    }

    // ── High-Band: Fein-Glimmer im Hintergrund ────────────
    float gx = sin(fp.x * 85.0 + u_time * 3.1);
    float gy = sin(fp.y * 85.0 - u_time * 2.4);
    col += u_pal_highlight * max(0.0, gx * gy) * u_high * 0.055;

    // ── Vignette ──────────────────────────────────────────
    float vig = 1.0 - smoothstep(0.38, 1.0, length(uv_raw - 0.5) * 2.0);
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

    // Additiv überlagern → helle Schweife ohne Überbelichtung
    col = max(col, trail * 0.88);
    col = clamp(col, 0.0, 1.0);

    fragColor = vec4(col, 1.0);
}
