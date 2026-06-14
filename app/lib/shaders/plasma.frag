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

// ── Seed ───────────────────────────────────────────────────
uniform float u_seed;        // 11 → DNA wird im Shader abgeleitet

// ── Palette ────────────────────────────────────────────────
uniform vec3 u_pal_shadow;    // 12–14
uniform vec3 u_pal_low;       // 15–17
uniform vec3 u_pal_high;      // 18–20
uniform vec3 u_pal_highlight; // 21–23

// ── Feedback ───────────────────────────────────────────────
uniform float u_fb_zoom;      // 24
uniform float u_fb_rotation;  // 25
uniform float u_fb_decay;     // 26
uniform float u_fb_warp_x;    // 27
uniform float u_fb_warp_y;    // 28

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

// Deterministischer 1D-Hash aus Seed + Salt
float hash_seed(float seed, float salt) {
    return fract(sin(seed * 12.9898 + salt * 78.233) * 43758.5453);
}

void main() {
    // ── DNA aus Seed ableiten ──────────────────────────────
    float d_zoom       = 0.7 + hash_seed(u_seed, 1.0) * 0.7;
    float d_rotation   = (0.4 + hash_seed(u_seed, 2.0) * 1.6)
                       * (hash_seed(u_seed, 3.0) > 0.5 ? 1.0 : -1.0);
    float d_warp_x     = (hash_seed(u_seed, 4.0) - 0.5) * 1.2;
    float d_warp_y     = (hash_seed(u_seed, 5.0) - 0.5) * 1.2;
    float d_wave_freq  = 1.0 + hash_seed(u_seed, 6.0) * 7.0;
    float d_color_speed= 0.2 + hash_seed(u_seed, 7.0) * 2.3;
    float d_spokes     = floor(2.0 + hash_seed(u_seed, 8.0) * 8.5);
    float d_bass_react = 0.3 + hash_seed(u_seed, 9.0) * 0.7;
    float d_mid_react  = 0.3 + hash_seed(u_seed, 10.0) * 0.7;
    float d_phase      = hash_seed(u_seed, 11.0) * 6.28318;

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
    float high_boost = 1.0 + u_high * d_bass_react * 2.2;
    float bf         = (1.4 + d_zoom * 0.8) * high_boost;

    float ba = 1.0 + u_bass * d_bass_react * 2.0;

    float tm = u_time * (0.5 + abs(d_rotation) * 0.45)
             + u_mid * d_mid_react * 0.25;

    float wf = d_wave_freq * 0.12;
    float ph = d_phase;

    vec2 wx  = normalize(vec2(1.0,   0.0)  + vec2( d_warp_x,  d_warp_y) * 0.25);
    vec2 wy  = normalize(vec2(0.0,   1.0)  + vec2(-d_warp_y,  d_warp_x) * 0.25);
    vec2 wd1 = normalize(vec2(0.707, 0.707)+ vec2( d_warp_x, -d_warp_y) * 0.2);
    vec2 wd2 = normalize(vec2(-0.707,0.707)+ vec2( d_warp_y,  d_warp_x) * 0.2);

    // ── Wellenakkumulation ─────────────────────────────────
    float n       = d_spokes;
    float p       = 0.0;
    float total_w = 0.0;
    float w;

    w = 1.0;
    p += w * sin(dot(uv, wx) * bf * 2.0  + tm        + ph * 1.00) * ba;
    total_w += w;

    w = clamp(n - 1.0, 0.0, 1.0);
    p += w * sin(dot(uv, wy) * bf * 1.75 + tm * 0.80 + ph * 1.31) * ba;
    total_w += w;

    w = clamp(n - 2.0, 0.0, 1.0);
    p += w * sin(dot(uv, wd1) * bf * 2.3 + tm * 1.20 + ph * 0.71) * ba;
    total_w += w;

    w = clamp(n - 3.0, 0.0, 1.0);
    vec2 c1 = vec2(d_warp_x, d_warp_y) * 0.45;
    p += w * sin(length(uv - c1) * bf * 1.60 + tm * 0.65 + ph * 1.73);
    total_w += w;

    w = clamp(n - 4.0, 0.0, 1.0);
    p += w * sin(dot(uv, wd2) * bf * (2.0 + wf) + tm * 1.40 + ph * 2.09) * ba;
    total_w += w;

    w = clamp(n - 5.0, 0.0, 1.0);
    vec2 c2 = vec2(-d_warp_y, d_warp_x) * 0.35;
    p += w * sin(length(uv + c2) * bf * (1.85 + wf) + tm * 0.90 + ph * 0.43);
    total_w += w;

    w = clamp(n - 6.0, 0.0, 1.0);
    float ang = atan(uv.y, uv.x);
    p += w * sin(ang * (2.5 + d_wave_freq) + length(uv) * bf + tm * 0.50 + ph * 3.00);
    total_w += w;

    w = clamp(n - 7.0, 0.0, 1.0);
    p += w * sin(uv.x * uv.y * bf * 2.8 + tm * 1.10 + ph * 1.94) * ba;
    total_w += w;

    w = clamp(n - 8.0, 0.0, 1.0);
    float diag30 = dot(uv, vec2(0.866, 0.5));
    p += w * sin(diag30 * bf * 3.2 + tm * 0.75 + ph * 2.55) * ba;
    total_w += w;

    w = clamp(n - 9.0, 0.0, 1.0);
    p += w * sin(length(uv) * uv.x * bf * 1.4 + tm * 1.30 + ph * 4.01);
    total_w += w;

    p = p / max(total_w, 0.001);
    float plasma = p * 0.5 + 0.5;

    // ── Farbe: HSV-Rainbow (klassisch) ────────────────────
    float hue = plasma + u_time * 0.07 * d_color_speed + ph / 6.28318;
    float brightness = clamp(0.25 + plasma * 0.75 + u_energy * 0.35, 0.0, 1.0);
    vec3 col = hsv2rgb(vec3(fract(hue), 1.0, brightness));

    float tint_strength = d_mid_react * 0.35;
    vec3 pal_tint = pal(fract(plasma * 0.7 + u_time * 0.025 * d_color_speed));
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
