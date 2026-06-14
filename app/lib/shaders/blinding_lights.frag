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

vec3 pal(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.333) return mix(u_pal_shadow, u_pal_low,       t * 3.0);
  if (t < 0.667) return mix(u_pal_low,     u_pal_high,      (t - 0.333) * 3.0);
                  return mix(u_pal_high,    u_pal_highlight, (t - 0.667) * 3.0);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5);
}

float hash_seed(float seed, float salt) {
  return fract(sin(seed * 12.9898 + salt * 78.233) * 43758.5453);
}


// Hilfsfunktion: Rauschen
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Hilfsfunktion: FBM Noise
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.0;
    a *= 0.5;
  }
  return v;
}

// Hilfsfunktion: Horizont-Linie für Sonnenuntergang
float horizon(vec2 uv, float y, float softness) {
  return smoothstep(y - softness, y + softness, uv.y);
}

// Hilfsfunktion: Horizont mit Neonstreifen
float neonHorizon(vec2 uv, float y, float count, float time) {
  float h = smoothstep(0.02, 0.0, abs(uv.y - y));
  float stripes = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float sy = y + (fi - 3.5) * 0.02;
    float move = sin(time * 0.5 + fi * 1.3) * 0.01;
    float line = smoothstep(0.004, 0.0, abs(uv.y - (sy + move)));
    stripes += line * (1.0 - fi * 0.1);
  }
  return max(h, stripes * 0.7);
}

// Hilfsfunktion: Retro-Grid für Boden
float retroGrid(vec2 uv, float freq, float y, float time) {
  vec2 p = uv;
  p.y -= y;
  if (p.y > 0.0) return 0.0;
  vec2 gp = p * freq;
  float gx = smoothstep(0.03, 0.0, abs(fract(gp.x) - 0.5));
  float gy = smoothstep(0.03, 0.0, abs(fract(gp.y + p.y * 0.5) - 0.5));
  return (gx + gy) * min(1.0, -p.y * 4.0);
}

// Hilfsfunktion: 80s Lasershow
float lasers(vec2 uv, float count, float time, float bass, float energy) {
  float result = 0.0;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float a = fi * 6.28318 / count + time * 0.3;
    vec2 dir = vec2(cos(a), sin(a));
    float d = abs(dot(uv, vec2(-dir.y, dir.x)));
    float width = 0.002 + bass * 0.004;
    float line = smoothstep(width, 0.0, d);
    float fade = 1.0 - length(uv) * 0.3;
    result += line * fade * (0.5 + 0.5 * sin(time * 2.0 + fi * 0.5));
  }
  return result;
}

// Hilfsfunktion: Retro-Sonne mit Neon-Gradient
vec3 sunNeon(vec2 uv, float centerY, float size, float colorPhase) {
  vec2 p = uv - vec2(0.0, centerY);
  float r = length(p);
  float glow = exp(-r * (4.0 / size)) * 0.8;
  float core = exp(-r * (12.0 / size)) * 1.2;
  float stripes = 0.0;
  float stripesCount = 8.0;
  float stripeAngle = atan(p.y, p.x);
  float stripeMask = smoothstep(0.15, 0.0, abs(fract(stripeAngle / 6.28318 * stripesCount) - 0.5));
  stripes = stripeMask * smoothstep(size * 0.6, 0.0, r) * 0.5;
  vec3 colTop = pal(fract(colorPhase));
  vec3 colBot = pal(fract(colorPhase + 0.4));
  vec3 col = mix(colBot, colTop, smoothstep(0.0, size, p.y + size * 0.5));
  return col * (glow + stripes + core);
}

// Hilfsfunktion: Skyline
float skyline(vec2 uv, float y, float time, float seed) {
  if (uv.y < y) return 0.0;
  vec2 p = uv - vec2(0.0, y);
  vec2 gp = p * 2.0;
  float h = hash(floor(gp * vec2(6.0, 1.0)));
  float building = step(h, 0.6) * smoothstep(0.0, 0.08, p.y / max(h * 0.3, 0.01));
  float neonWindow = 0.0;
  vec2 wp = p * 12.0;
  float w = smoothstep(0.05, 0.0, abs(fract(wp.x) - 0.5)) * smoothstep(0.0, 0.15, p.y);
  neonWindow += w * step(0.4, hash(floor(wp) + seed));
  return building * 0.6 + neonWindow * 0.4;
}

void main() {
  // ════════════════════════════════════════════════════════
  // DNA aus Seed ableiten (20+ Parameter)
  // ════════════════════════════════════════════════════════
  float d_style        = hash_seed(u_seed,  1.0);              // 0=sunset, 0.33=grid, 0.66=city, 1=lasers
  float d_sun_size     = 0.3 + hash_seed(u_seed,  2.0) * 0.7;
  float d_sun_y        = -0.4 + hash_seed(u_seed,  3.0) * 0.8;
  float d_sun_stripes  = hash_seed(u_seed,  4.0) > 0.5 ? 1.0 : 0.0;
  float d_color_speed  = 0.05 + hash_seed(u_seed,  5.0) * 0.6;
  float d_color_offset = hash_seed(u_seed,  6.0);
  float d_bass_react   = 0.4 + hash_seed(u_seed,  7.0) * 1.0;
  float d_mid_react    = 0.4 + hash_seed(u_seed,  8.0) * 1.0;
  float d_high_react   = 0.3 + hash_seed(u_seed,  9.0) * 1.0;
  float d_rotation     = (hash_seed(u_seed, 10.0) - 0.5) * 0.5;
  float d_warp_x       = (hash_seed(u_seed, 11.0) - 0.5) * 1.4;
  float d_warp_y       = (hash_seed(u_seed, 12.0) - 0.5) * 1.4;
  float d_pulse_str    = 0.2 + hash_seed(u_seed, 13.0) * 1.0;
  float d_stereo_str   = 0.05 + hash_seed(u_seed, 14.0) * 0.4;
  float d_fft_react    = 0.2 + hash_seed(u_seed, 15.0) * 1.0;
  float d_laser_count  = floor(3.0 + hash_seed(u_seed, 16.0) * 9.0);
  float d_grid_size    = 3.0 + hash_seed(u_seed, 17.0) * 8.0;
  float d_grid_persp   = 0.3 + hash_seed(u_seed, 18.0) * 0.7;
  float d_skyline_h    = 0.1 + hash_seed(u_seed, 19.0) * 0.4;
  float d_detail_amp   = 0.5 + hash_seed(u_seed, 20.0) * 1.5;

  // ── UV Setup ────────────────────────────────────────────
  vec2 uv_raw = FlutterFragCoord().xy / vec2(u_width, u_height);
  vec2 uv = uv_raw * 2.0 - 1.0;
  uv.x *= u_width / u_height;

  // ── Beat / BPM ──────────────────────────────────────────
  float beat_dur   = 60.0 / max(u_bpm, 60.0);
  float beat_count = floor(u_time / beat_dur);
  float beat_phase = fract(u_time / beat_dur);
  float beat_kick  = exp(-beat_phase * 8.0);
  float pulse      = 1.0 + beat_kick * d_pulse_str;

  // ── Stereo ──────────────────────────────────────────────
  float lr_diff = u_bass_right - u_bass_left;
  float stereo_shift = lr_diff * d_stereo_str * u_stereo;
  uv.x += stereo_shift;

  // ── Frequenzbänder aus Audio-Uniforms ────────────────────
  float fft_bass  = u_bass;
  float fft_mid   = u_mid;
  float fft_high  = u_high;
  float fft_peak  = u_energy;

  // ── Rotation ────────────────────────────────────────────
  float angle = u_time * d_rotation * 0.12 + u_mid * d_mid_react * 0.3;
  float c = cos(angle), s = sin(angle);
  uv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);

  // ── Warp ────────────────────────────────────────────────
  float mid_warp = u_mid * d_mid_react * 0.2;
  uv.x += sin(uv.y * 2.0 + u_time * 0.5) * (d_warp_x + mid_warp) * 0.2;
  uv.y += cos(uv.x * 2.0 - u_time * 0.4) * (d_warp_y + mid_warp * 0.7) * 0.2;

  vec2 uv0 = uv;

  // ── Szenen-Aufbau ───────────────────────────────────────
  vec3 col = vec3(0.0);

  if (d_style < 0.33) {
    // ═══ SZENE 1: Synthwave Sunset ════════════════════
    vec3 skyCol = mix(u_pal_low * 0.3, u_pal_shadow, smoothstep(-0.4, 0.6, uv.y));
    col = skyCol;
    float sunY = d_sun_y - 0.2 + fft_bass * d_fft_react * 0.3;
    vec3 sunGlow = sunNeon(uv, sunY, d_sun_size * pulse, d_color_offset + u_time * d_color_speed);
    col += sunGlow;
    float horY = sunY - d_sun_size * 0.5;
    float neonLine = neonHorizon(uv, horY, 4.0, u_time);
    col += u_pal_highlight * neonLine * (1.2 + u_bass * d_bass_react);
    float grid = retroGrid(uv, d_grid_size, horY, u_time);
    col += u_pal_highlight * grid * 0.9 * pulse;
    // Lasers in der Szene
    float laser = lasers(uv, d_laser_count, u_time, fft_bass, u_energy);
    col += u_pal_high * laser * 0.8 * beat_kick;
  } else if (d_style < 0.66) {
    // ═══ SZENE 2: Tron Grid + Horizont ════════════════
    float perspective = 1.0 / max(0.5 + uv.y * 0.5, 0.1);
    vec2 gridUV = vec2(uv.x, perspective) * d_grid_size;
    gridUV += u_time * 0.5;
    float gx = smoothstep(0.04, 0.0, abs(fract(gridUV.x) - 0.5));
    float gy = smoothstep(0.04, 0.0, abs(fract(gridUV.y) - 0.5));
    float gridField = max(gx, gy) * min(1.0, max(0.0, -uv.y + 1.0));
    col = mix(u_pal_shadow * 0.2, u_pal_low * 0.4, gridField * 0.3);
    col += u_pal_highlight * gridField * (0.8 + u_bass * d_bass_react) * pulse;
    // Horizont-Linie
    float horY = 0.1 + sin(u_time * 0.2) * 0.05 + fft_mid * d_fft_react * 0.2;
    float horizonLine = smoothstep(0.015, 0.0, abs(uv.y - horY));
    col += u_pal_highlight * horizonLine * 2.0;
    // Sonne im Hintergrund
    vec3 sunCol = pal(fract(d_color_offset + u_time * d_color_speed));
    col += sunCol * exp(-length(uv - vec2(0.0, horY + 0.15)) * 3.0) * 0.6;
    // Lasers
    float laser = lasers(uv, d_laser_count * 0.6, u_time, fft_bass, u_energy);
    col += u_pal_high * laser * 0.6 * beat_kick;
  } else {
    // ═══ SZENE 3: Neon City Skyline ════════════════════
    col = mix(u_pal_low * 0.2, u_pal_shadow * 0.5, smoothstep(-1.0, 1.0, uv.y + 0.5));
    float buildLine = skyline(uv, d_skyline_h, u_time, u_seed);
    col = mix(col, u_pal_high * 0.7, buildLine);
    // Neon-Wolken
    vec2 cloudUV = uv * 3.0 + u_time * 0.1;
    float clouds = fbm(cloudUV) * 0.5;
    col += u_pal_highlight * clouds * (0.2 + u_energy * 0.3) * smoothstep(-0.2, 0.5, uv.y);
    // Boden-Reflexion
    float reflection = retroGrid(uv, d_grid_size, d_skyline_h - 0.05, u_time) * 0.4;
    col += u_pal_low * reflection * (0.5 + fft_mid);
    // Lasers
    float laser = lasers(uv, d_laser_count * 0.8, u_time * 1.2, fft_bass, u_energy);
    col += u_pal_highlight * laser * 0.7 * beat_kick;
  }

  // ── FFT-Balken (vertikal am Bildrand) ───────────────────
  float fft_bar_count = 16.0;
  float fft_bar = 0.0;
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    float pos = fi / fft_bar_count;
    float x = (fi / fft_bar_count) * 2.0 - 0.9;
    float width = 1.0 / fft_bar_count * 0.8;
    float inBar = smoothstep(x - width, x, uv.x) * (1.0 - smoothstep(x, x + width, uv.x));
    float hVal = mix(mix(u_bass, u_mid,  clamp(pos * 2.0,       0.0, 1.0)),
                         u_high, clamp(pos * 2.0 - 1.0, 0.0, 1.0));
    float barH = hVal * 1.2;
    float top = 0.9;
    float bottom = top - barH;
    float inH = smoothstep(bottom - 0.02, bottom, uv.y) * (1.0 - smoothstep(top - 0.02, top, uv.y));
    fft_bar += inBar * inH * hVal;
  }
  col += u_pal_highlight * fft_bar * 0.6 * pulse;
  col += u_pal_high * fft_bar * 0.3;

  // ── Stereo-L/R Neon-Bögen ───────────────────────────────
  float s_off = u_stereo * 0.05;
  col += u_pal_low  * exp(-length(uv0 + vec2(s_off * u_bass_left,  0.0)) * 4.0) * u_bass_left  * u_stereo * 0.15;
  col += u_pal_low  * exp(-length(uv0 - vec2(s_off * u_bass_right, 0.0)) * 4.0) * u_bass_right * u_stereo * 0.15;

  // ── FFT-Detail-Rauschen auf Oberfläche ───────────────────
  float detailNoise = smoothstep(0.4, 0.8, noise(uv * 8.0 + u_time * 0.3)) * u_high * d_high_react;
  col += u_pal_highlight * detailNoise * 0.15;

  // ── Beat-Flash ──────────────────────────────────────────
  col += beat_kick * 0.06 * u_pal_highlight;

  // ── Zentraler Glow ───────────────────────────────────────
  float glow = exp(-length(uv0) * (1.8 - u_energy));
  col += u_pal_low * glow * 0.15;
  col += u_pal_high * glow * beat_kick * 0.5;

  // ── Vignette ────────────────────────────────────────────
  float vig = 1.0 - dot(uv0 * 1.1, uv0 * 1.1);
  col *= clamp(vig, 0.0, 1.0);

  // ── Feedback ────────────────────────────────────────────
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
                * u_fb_decay * 0.3 * (ef.x * ef.y);

  col = feedback + col;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
