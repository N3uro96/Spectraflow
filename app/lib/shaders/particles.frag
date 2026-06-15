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
float ph(float id, float salt) {
    return fract(sin(id * 127.1 + salt * 311.7 + u_seed * 113.5) * 43758.5453);
}
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
float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.0 + vec2(7.1, 3.7); a *= 0.5; }
    return s;
}

vec3 pal(float t) {
    t = clamp(t, 0.0, 1.0);
    if (t < 0.333) return mix(u_pal_shadow,  u_pal_low,       t * 3.0);
    if (t < 0.667) return mix(u_pal_low,      u_pal_high,      (t - 0.333) * 3.0);
    return               mix(u_pal_high,      u_pal_highlight, (t - 0.667) * 3.0);
}

mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// EINE Partikel-Kernform pro Session (uniforme Verzweigung -> keine Divergenz).
float core_of(vec2 d, float sz, float type, vec2 vd) {
    float r = length(d) / max(sz, 0.001);
    if (type < 0.5) {
        return exp(-r * r * 4.0);                                   // Glow-Punkt
    } else if (type < 1.5) {
        return exp(-pow(r - 0.6, 2.0) * 30.0) + exp(-r * r * 6.0) * 0.3; // Ring
    } else if (type < 2.5) {
        vec2 vp = vec2(-vd.y, vd.x);
        float along = dot(d, -vd) / sz;
        float perp  = dot(d, vp) / sz;
        return exp(-max(along, 0.0) * 1.8 - perp * perp * 22.0)
             + exp(-r * r * 8.0) * 0.4;                             // Komet
    } else {
        float core = exp(-r * r * 3.0);
        float arms = exp(-r * r * 14.0) * (1.0 + cos(atan(d.y, d.x) * 6.0) * 0.8);
        return core * 0.4 + arms;                                   // Kristall
    }
}

void main() {
    vec2 fc = FlutterFragCoord().xy;
    vec2 res = vec2(u_width, u_height);
    float asp = u_width / u_height;

    // ── GENETIK ────────────────────────────────────────────
    float d_type     = floor(dna(1.0) * 4.0);
    float d_behavior = floor(dna(2.0) * 4.0);          // 0 Bahnen 1 Lissajous 2 Galaxie 3 Kugel
    float d_count    = floor(dna(3.0) * 17.0) + 22.0;  // 22-38
    float d_scale    = dna(4.0) * 0.4 + 0.45;
    float d_speed    = dna(5.0) * 0.8 + 0.4;
    float d_size     = dna(6.0) * 0.025 + 0.02;
    float d_clrdrift = dna(7.0) * 0.4 + 0.1;
    float d_swirl    = (dna(8.0) - 0.5) * 2.0;

    // ── BEAT & AUDIO ───────────────────────────────────────
    float beat_time  = u_time * (max(u_bpm, 60.0) / 60.0);
    float beat_pulse = exp(-fract(beat_time) * 4.0) * u_bass;
    float speed_mod  = 1.0 + u_energy * 1.5;
    float stereo_push = (u_bass_left - u_bass_right) * 0.25;

    vec2 uv_raw = fc / res;
    vec2 fp = (uv_raw - 0.5) * vec2(asp, 1.0) * 2.0;

    // ── HINTERGRUND: Nebel + Sternenfeld ───────────────────
    vec2 nb = fp * 0.6;
    float warp = fbm(nb + vec2(u_time * 0.03, -u_time * 0.02));
    float neb  = fbm(nb + warp * 1.2 + vec2(0.0, u_time * 0.015));
    vec3 col = mix(u_pal_shadow * 0.05, u_pal_low * 0.18, neb)
             * (0.4 + u_energy * 0.7 + beat_pulse * 0.4);

    // Funkelnde Sterne (billiges Hash-Gitter)
    vec2 sg = fp * 26.0;
    vec2 sid = floor(sg);
    float star = hash21(sid);
    float tw = 0.5 + 0.5 * sin(u_time * 3.0 + star * TAU);
    float sdot = smoothstep(0.86, 1.0, hash21(sid + 3.1))
               * smoothstep(0.12, 0.0, length(fract(sg) - 0.5));
    col += u_pal_highlight * sdot * tw * (0.3 + u_high * 1.2);

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
            float ang = t * d_swirl + p_phase;
            pos.x = cos(ang) * p_rad;
            pos.y = sin(ang) * p_rad;
            pos.z = z_base + sin(t * 0.4 + p_phase) * 0.35;
            pos.xy *= 1.0 + beat_pulse * 0.18;
        } else if (d_behavior < 1.5) {
            float fx = 2.0 + floor(ph(id, 7.0) * 3.0);
            float fy = 3.0 + floor(ph(id, 8.0) * 3.0);
            pos.x = sin(t * 0.7 + p_phase) * p_rad * 1.1;
            pos.y = sin(t * 0.7 * (fy / fx) + p_phase * 1.3) * p_rad * 1.1;
            pos.z = z_base + cos(t * 0.5) * 0.25;
        } else if (d_behavior < 2.5) {
            float life = fract(t * 0.12 + p_phase);
            float spiral = life * 6.0 * d_swirl + p_phase + t * 0.2;
            float rad = mix(0.05, p_rad * 1.6, life);
            pos.x = cos(spiral) * rad;
            pos.y = sin(spiral) * rad;
            pos.z = z_base + life * 0.4;
        } else {
            // Verhalten 3: rotierende 3D-Kugelschale
            float ya = ph(id, 9.0) * 2.0 - 1.0;
            float rr = sqrt(max(1.0 - ya * ya, 0.0));
            float th = id * 2.399 + t * 0.5;
            pos = vec3(cos(th) * rr, ya, sin(th) * rr) * p_rad * 1.3;
            pos.xz = rot2(t * 0.3 * d_swirl) * pos.xz;
            pos.z += 1.0;
            pos.xy *= 1.0 + beat_pulse * 0.2;
        }

        pos.x += stereo_push;
        pos.x += sin(u_time * 1.8 + p_phase) * u_mid * 0.06;
        pos.y += cos(u_time * 1.4 + p_phase) * u_high * 0.04;

        float z_safe = max(pos.z, 0.1);
        vec2 screen_pos = pos.xy / z_safe;
        float sz = d_size * p_szmod / z_safe;

        vec2 dvec = fp - screen_pos;
        // weiter cullen (Glow-Halo reicht weiter als der Kern)
        if (dot(dvec, dvec) > (sz * 7.0) * (sz * 7.0)) continue;

        vec2 vd = normalize(screen_pos - fp + vec2(0.0001));

        float core = core_of(dvec, sz, d_type, vd);
        float glow = exp(-dot(dvec, dvec) / (sz * sz * 7.0));   // weicher Halo

        float depth_grad = 1.0 - clamp(pos.z / 2.0, 0.0, 1.0);
        // Tiefenschärfe: ferne Partikel weicher/dunkler
        float dof = mix(0.45, 1.0, depth_grad);
        float ct = fract(p_hue + depth_grad * 0.3 + u_time * d_clrdrift * 0.05);
        vec3 pcol = pal(ct);

        float bright = (1.1 / z_safe) * (0.7 + u_energy * 0.5 + beat_pulse * 0.8) * dof;
        accum += pcol * core * bright;                       // scharfer Kern
        accum += pcol * glow * bright * 0.35;                // Bloom-Halo
        accum += u_pal_highlight * pow(core, 3.0) * bright * 0.4; // heller Glanzpunkt
    }

    col += accum;

    // Vignette
    col *= 1.0 - smoothstep(0.4, 1.0, length(uv_raw - 0.5) * 2.0) * 0.8;

    // ── FEEDBACK STATE (mit chromatischer Aberration) ──────
    vec2 fb = uv_raw - 0.5;
    fb /= u_fb_zoom;
    fb = rot2(-u_fb_rotation) * fb;
    fb.x += sin(fb.y * 7.0 + u_time) * u_fb_warp_x * (0.4 + u_mid * 0.6);
    fb.y += cos(fb.x * 7.0 - u_time) * u_fb_warp_y * (0.4 + u_mid * 0.6);
    fb += 0.5;

    vec2 ef = smoothstep(0.0, 0.03, fb) * (1.0 - smoothstep(0.97, 1.0, fb));
    float fade = ef.x * ef.y;
    vec2 caDir = uv_raw - 0.5;
    float ca = 0.0015 + u_energy * 0.004;
    vec3 prev;
    prev.r = texture(u_prev_frame, clamp(fb + caDir * ca, 0.001, 0.999)).r;
    prev.g = texture(u_prev_frame, clamp(fb,              0.001, 0.999)).g;
    prev.b = texture(u_prev_frame, clamp(fb - caDir * ca, 0.001, 0.999)).b;
    col = max(col, prev * u_fb_decay * fade * 0.92);

    col = 1.0 - exp(-col);
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
