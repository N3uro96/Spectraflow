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

// u_seed liegt in [0,1) (in Dart normalisiert) -> GPU-sichere sin()-Argumente.
float ph(float id, float salt) {
    return fract(sin(id * 127.1 + salt * 311.7 + u_seed * 113.5) * 43758.5453);
}

float dna(float salt) {
    return fract(sin(salt * 78.233 + u_seed * 113.5) * 43758.5453);
}

vec3 pal(float t) {
    t = clamp(t, 0.0, 1.0);
    if (t < 0.333) return mix(u_pal_shadow,  u_pal_low,       t * 3.0);
    if (t < 0.667) return mix(u_pal_low,      u_pal_high,      (t - 0.333) * 3.0);
    return               mix(u_pal_high,      u_pal_highlight, (t - 0.667) * 3.0);
}

mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// ── EINE Partikelform pro Session ──────────────────────────
// d_type ist uniform (für alle Fragmente gleich), daher ist diese
// if/else-Kette eine uniforme Verzweigung -> keine Warp-Divergenz,
// es wird nur EINE Form berechnet (statt vorher alle 8).
float shape_of(vec2 d, float sz, float type, vec2 vd) {
    float r = length(d) / max(sz, 0.001);

    if (type < 0.5) {
        // Weicher Glow-Punkt
        return exp(-r * r * 4.0);
    } else if (type < 1.5) {
        // Ring / Halo
        return exp(-pow(r - 0.6, 2.0) * 30.0) + exp(-r * r * 6.0) * 0.3;
    } else if (type < 2.5) {
        // Kometen-Schweif entlang der Flugrichtung
        vec2 vp = vec2(-vd.y, vd.x);
        float along = dot(d, -vd) / sz;
        float perp  = dot(d, vp) / sz;
        return exp(-max(along, 0.0) * 1.8 - perp * perp * 22.0)
             + exp(-r * r * 8.0) * 0.4;
    } else {
        // Funkelnder Kristall / Stern
        float core = exp(-r * r * 3.0);
        float arms = exp(-r * r * 14.0) * (1.0 + cos(atan(d.y, d.x) * 6.0) * 0.8);
        return core * 0.4 + arms;
    }
}

void main() {
    vec2 fc = FlutterFragCoord().xy;
    vec2 res = vec2(u_width, u_height);
    float asp = u_width / u_height;

    // ── GENETIK ────────────────────────────────────────────
    float d_type     = floor(dna(1.0) * 4.0);          // EINE Form für alle
    float d_behavior = floor(dna(2.0) * 3.0);          // 0=Bahnen 1=Lissajous 2=Spiralgalaxie
    float d_count    = floor(dna(3.0) * 17.0) + 22.0;  // 22-38 Partikel
    float d_scale    = dna(4.0) * 0.4 + 0.45;          // System-Größe
    float d_speed    = dna(5.0) * 0.8 + 0.4;           // Grundtempo
    float d_size     = dna(6.0) * 0.025 + 0.02;        // Partikelgröße
    float d_clrdrift = dna(7.0) * 0.4 + 0.1;
    float d_swirl    = (dna(8.0) - 0.5) * 2.0;         // Drehsinn

    // ── BEAT & AUDIO ───────────────────────────────────────
    float beat_time  = u_time * (max(u_bpm, 60.0) / 60.0);
    float beat_pulse = exp(-fract(beat_time) * 4.0) * u_bass;
    float speed_mod  = 1.0 + u_energy * 1.5;
    float stereo_push = (u_bass_left - u_bass_right) * 0.25;

    vec2 uv_raw = fc / res;
    vec2 fp = (uv_raw - 0.5) * vec2(asp, 1.0) * 2.0;

    vec3 accum = vec3(0.0);

    // ── PARTIKEL-SCHLEIFE ──────────────────────────────────
    for (int i = 0; i < 40; i++) {
        if (float(i) >= d_count) break;
        float id = float(i);

        float p_phase = ph(id, 1.0) * TAU;
        float p_rad   = (ph(id, 2.0) * 0.7 + 0.3) * d_scale;
        float p_spd   = (ph(id, 3.0) * 0.7 + 0.5) * d_speed;
        float z_base  = ph(id, 4.0) * 1.4 + 0.5;
        float p_hue   = ph(id, 5.0);
        float p_szmod = ph(id, 6.0) * 0.5 + 0.7;

        float t = u_time * p_spd * speed_mod;
        vec3 pos = vec3(0.0);

        if (d_behavior < 0.5) {
            // Verhalten 0: gleitende, geschachtelte Bahnen (sanfte Ringe)
            float ang = t * d_swirl + p_phase;
            pos.x = cos(ang) * p_rad;
            pos.y = sin(ang) * p_rad;
            // langsames Vor-/Zurückgleiten in der Tiefe
            pos.z = z_base + sin(t * 0.4 + p_phase) * 0.35;
            pos.xy *= 1.0 + beat_pulse * 0.18;
        } else if (d_behavior < 1.5) {
            // Verhalten 1: anmutige Lissajous-Figuren (sich kreuzende Achten)
            float fx = 2.0 + floor(ph(id, 7.0) * 3.0);
            float fy = 3.0 + floor(ph(id, 8.0) * 3.0);
            pos.x = sin(t * 0.7 + p_phase) * p_rad * 1.1;
            pos.y = sin(t * 0.7 * (fy / fx) + p_phase * 1.3) * p_rad * 1.1;
            pos.z = z_base + cos(t * 0.5) * 0.25;
        } else {
            // Verhalten 2: Spiralgalaxie – sanftes Ein-/Auswärtsströmen
            float life = fract(t * 0.12 + p_phase);
            float spiral = life * 6.0 * d_swirl + p_phase + t * 0.2;
            float rad = mix(0.05, p_rad * 1.6, life);
            pos.x = cos(spiral) * rad;
            pos.y = sin(spiral) * rad;
            pos.z = z_base + life * 0.4;
        }

        // Stereo & feine Audio-Auslenkung
        pos.x += stereo_push;
        pos.x += sin(u_time * 1.8 + p_phase) * u_mid * 0.06;
        pos.y += cos(u_time * 1.4 + p_phase) * u_high * 0.04;

        // 3D-Projektion
        float z_safe = max(pos.z, 0.1);
        vec2 screen_pos = pos.xy / z_safe;
        float sz = d_size * p_szmod / z_safe;

        // Distanz-Cull
        vec2 dvec = fp - screen_pos;
        if (dot(dvec, dvec) > (sz * 4.5) * (sz * 4.5)) continue;

        // Flugrichtung (für Kometen-Form)
        vec2 vd = normalize(screen_pos - fp + vec2(0.0001));

        float intensity = shape_of(dvec, sz, d_type, vd);
        if (intensity < 0.004) continue;

        float depth_grad = 1.0 - clamp(pos.z / 2.0, 0.0, 1.0);
        float ct = fract(p_hue + depth_grad * 0.3 + u_time * d_clrdrift * 0.05);
        vec3 pcol = pal(ct);

        float bright = (1.1 / z_safe) * (0.7 + u_energy * 0.5 + beat_pulse * 0.8);
        accum += pcol * intensity * bright;
    }

    vec3 col = u_pal_shadow * 0.04 + accum;

    // Vignette
    float vig = 1.0 - smoothstep(0.4, 0.98, length(uv_raw - 0.5) * 2.0);
    col *= vig;

    // ── FEEDBACK STATE ─────────────────────────────────────
    vec2 fb = uv_raw - 0.5;
    fb /= u_fb_zoom;
    fb = rot2(-u_fb_rotation) * fb;
    fb.x += sin(fb.y * 7.0 + u_time) * u_fb_warp_x * (0.4 + u_mid * 0.6);
    fb.y += cos(fb.x * 7.0 - u_time) * u_fb_warp_y * (0.4 + u_mid * 0.6);
    fb += 0.5;

    vec2 edge_fade = smoothstep(0.0, 0.03, fb) * (1.0 - smoothstep(0.97, 1.0, fb));
    float fade = edge_fade.x * edge_fade.y;

    vec3 prev = texture(u_prev_frame, clamp(fb, 0.001, 0.999)).rgb;
    col = max(col, prev * u_fb_decay * fade * 0.92);

    col = 1.0 - exp(-col);
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
