#include <flutter/runtime_effect.glsl>

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
uniform float u_seed;        // 11
uniform vec3  u_pal_shadow;   // 12–14
uniform vec3  u_pal_low;      // 15–17
uniform vec3  u_pal_high;     // 18–20
uniform vec3  u_pal_highlight;// 21–23
uniform float u_fb_zoom;      // 24
uniform float u_fb_rotation;  // 25
uniform float u_fb_decay;     // 26
uniform float u_fb_warp_x;    // 27
uniform float u_fb_warp_y;    // 28
uniform sampler2D u_prev_frame;

out vec4 fragColor;

vec3 pal(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.333) return mix(u_pal_shadow, u_pal_low,       t * 3.0);
  if (t < 0.667) return mix(u_pal_low,    u_pal_high,      (t - 0.333) * 3.0);
                  return mix(u_pal_high,   u_pal_highlight, (t - 0.667) * 3.0);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float hash_seed(float seed, float salt) {
  return fract(sin(seed * 12.9898 + salt * 78.233) * 43758.5453);
}

void main() {
  // ════════════════════════════════════════════════════════
  // DNA — 20 Parameter
  // ════════════════════════════════════════════════════════
  float d_zoom        = 0.7  + hash_seed(u_seed,  1.0) * 0.7;
  float d_rotation    = (0.4 + hash_seed(u_seed,  2.0) * 1.6)
                      * (hash_seed(u_seed, 3.0) > 0.5 ? 1.0 : -1.0);
  float d_warp_x      = (hash_seed(u_seed,  4.0) - 0.5) * 1.4;
  float d_warp_y      = (hash_seed(u_seed,  5.0) - 0.5) * 1.4;
  float d_wave_freq   = 1.0  + hash_seed(u_seed,  6.0) * 7.0;
  float d_color_speed = 0.2  + hash_seed(u_seed,  7.0) * 2.3;
  float d_layers      = floor(2.0 + hash_seed(u_seed,  8.0) * 8.0); // 2–9 Wellenschichten
  float d_bass_react  = 0.3  + hash_seed(u_seed,  9.0) * 0.7;
  float d_mid_react   = 0.3  + hash_seed(u_seed, 10.0) * 0.7;
  float d_phase       = hash_seed(u_seed, 11.0) * 6.28318;
  // ── Neue Parameter ──────────────────────────────────────
  float d_symmetry_n  = floor(1.0 + hash_seed(u_seed, 12.0) * 7.0); // 1–7 radiale Falten
  float d_color_style = hash_seed(u_seed, 13.0);   // 0=rainbow 0.5=tinted 1=palette
  float d_pulse_str   = 0.3  + hash_seed(u_seed, 14.0) * 1.2;
  float d_stereo_str  = 0.03 + hash_seed(u_seed, 15.0) * 0.18;
  float d_high_react  = 0.2  + hash_seed(u_seed, 16.0) * 0.9;
  float d_chaos       = hash_seed(u_seed, 17.0) * 0.6;  // chaotische Zusatz-Terme
  float d_zoom_react  = hash_seed(u_seed, 18.0) * 0.5;  // Bass → Zoom
  float d_radial_mix  = hash_seed(u_seed, 19.0);         // Mix radialer Terme
  float d_inner_fade  = hash_seed(u_seed, 20.0) * 0.5;  // Dunkel-Ring im Zentrum

  // ── UV Setup ────────────────────────────────────────────
  vec2 uv_raw = FlutterFragCoord().xy / vec2(u_width, u_height);
  vec2 uv     = uv_raw * 2.0 - 1.0;
  uv.x       *= u_width / u_height;

  // ── Beat ────────────────────────────────────────────────
  float beat_dur   = 60.0 / max(u_bpm, 60.0);
  float beat_count = floor(u_time / beat_dur);
  float beat_phase = fract(u_time / beat_dur);
  float beat_kick  = exp(-beat_phase * 8.0);

  // ── Stereo-Verschiebung ──────────────────────────────────
  float lr_diff = u_bass_right - u_bass_left;
  uv.x -= lr_diff * d_stereo_str * u_stereo;

  // ── Bass → Zoom ──────────────────────────────────────────
  uv /= 1.0 + u_bass * d_zoom_react * 0.35
            + beat_kick * d_pulse_str * 0.08;

  // ── Rotation ────────────────────────────────────────────
  float rot = u_time * d_rotation * 0.08 + u_mid * d_mid_react * 0.2;
  float c = cos(rot), s = sin(rot);
  uv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);

  // ── Radiale Symmetrie-Faltung (d_symmetry_n ≥ 2) ────────
  // Seeds mit hoher symmetry_n sehen dramatisch anders aus
  if (d_symmetry_n >= 2.0) {
    float r_uv = length(uv);
    float a_uv = atan(uv.y, uv.x);
    float seg   = 6.28318 / d_symmetry_n;
    float af    = mod(a_uv + seg * 0.5 + d_phase * 0.1, seg) - seg * 0.5;
    uv = vec2(cos(abs(af)), sin(abs(af))) * r_uv;
  }

  // ── Warp ────────────────────────────────────────────────
  float tm  = u_time * (0.5 + abs(d_rotation) * 0.4) + u_mid * d_mid_react * 0.2;
  float ba  = 1.0 + u_bass * d_bass_react * 1.8;
  float wf  = d_wave_freq * 0.12;
  float ph  = d_phase;

  vec2 wx   = normalize(vec2(1.0, 0.0) + vec2( d_warp_x,  d_warp_y) * 0.22);
  vec2 wy   = normalize(vec2(0.0, 1.0) + vec2(-d_warp_y,  d_warp_x) * 0.22);
  vec2 wd1  = normalize(vec2(0.707,  0.707) + vec2( d_warp_x, -d_warp_y) * 0.18);
  vec2 wd2  = normalize(vec2(-0.707, 0.707) + vec2( d_warp_y,  d_warp_x) * 0.18);

  float bf  = (1.4 + d_zoom * 0.8) * (1.0 + u_high * d_bass_react * 2.0);

  // ── Wellenakkumulation ────────────────────────────────────
  float n = d_layers;
  float p = 0.0, tw = 0.0, w;

  w = 1.0; p += w*sin(dot(uv, wx)  * bf * 2.0  + tm       + ph * 1.00)*ba; tw += w;
  w = clamp(n-1.0,0.0,1.0); p += w*sin(dot(uv,wy)*bf*1.75+tm*.80+ph*1.31)*ba; tw += w;
  w = clamp(n-2.0,0.0,1.0); p += w*sin(dot(uv,wd1)*bf*2.3+tm*1.20+ph*.71)*ba; tw += w;
  w = clamp(n-3.0,0.0,1.0);
  p += w * sin(length(uv - vec2(d_warp_x, d_warp_y)*0.4) * bf*1.6 + tm*.65 + ph*1.73);
  tw += w;
  w = clamp(n-4.0,0.0,1.0); p += w*sin(dot(uv,wd2)*bf*(2.0+wf)+tm*1.40+ph*2.09)*ba; tw += w;
  w = clamp(n-5.0,0.0,1.0);
  p += w * sin(length(uv + vec2(-d_warp_y, d_warp_x)*0.3)*bf*(1.85+wf)+tm*.90+ph*.43);
  tw += w;
  w = clamp(n-6.0,0.0,1.0);
  float ang = atan(uv.y, uv.x);
  p += w * sin(ang * (2.5 + d_wave_freq) + length(uv)*bf + tm*.50 + ph*3.00);
  tw += w;
  w = clamp(n-7.0,0.0,1.0); p += w*sin(uv.x*uv.y*bf*2.8+tm*1.10+ph*1.94)*ba; tw += w;
  w = clamp(n-8.0,0.0,1.0);
  p += w * sin(dot(uv, vec2(0.866, 0.5))*bf*3.2+tm*.75+ph*2.55)*ba;
  tw += w;

  // Chaos-Terme (manche Seeds haben extremere Strukturen)
  p += d_chaos * sin(uv.x * bf * 5.0 + tm * 1.8 + ph * 0.33) * ba * 0.5;
  p += d_chaos * cos(uv.y * bf * 4.2 - tm * 2.1 + ph * 1.17) * ba * 0.5;
  tw += d_chaos;

  // Radiale Terme (Ringe im Zentrum)
  p += d_radial_mix * sin(length(uv) * bf * 2.0 - tm * 0.6 + ph) * ba;
  tw += d_radial_mix;

  p = p / max(tw, 0.001);
  float plasma = p * 0.5 + 0.5;

  // Innerer Dunkel-Ring
  float inner = smoothstep(d_inner_fade, 0.0, length(uv));
  plasma = mix(plasma, 0.0, inner * 0.7);

  // ── Farbe ────────────────────────────────────────────────
  float hue  = plasma + u_time * 0.07 * d_color_speed + ph / 6.28318 + beat_count * 0.08;
  hue       += u_bass * d_bass_react * 0.12;
  float bri  = clamp(0.25 + plasma * 0.75 + u_energy * 0.35 + beat_kick * 0.12, 0.0, 1.0);
  bri       += u_high * d_high_react * 0.2 * plasma;

  vec3 col;
  if (d_color_style < 0.33) {
    // Rainbow HSV (klassisch)
    col = hsv2rgb(vec3(fract(hue), 1.0, bri));
  } else if (d_color_style < 0.66) {
    // Rainbow + Palette Tint
    vec3 hsv  = hsv2rgb(vec3(fract(hue), 1.0, bri));
    vec3 tint = pal(fract(plasma * 0.7 + u_time * 0.02 * d_color_speed));
    col = mix(hsv, hsv * tint * 2.0, 0.45);
  } else {
    // Reiner Palette-Modus (keine HSV)
    col = pal(fract(hue)) * bri;
    col += pal(fract(hue + 0.5)) * (1.0 - plasma) * bri * 0.5;
  }

  // ── Beat-Flash + Energie ─────────────────────────────────
  col += beat_kick * 0.10 * u_pal_highlight * bri;
  col *= 1.0 + u_energy * 0.4;

  // ── Stereo-Bögen ────────────────────────────────────────
  vec2 uv_s = uv_raw * 2.0 - 1.0;
  uv_s.x   *= u_width / u_height;
  float s_off = u_stereo * 0.03;
  col += u_pal_low * exp(-length(uv_s + vec2(s_off * u_bass_left,  0.0)) * 4.5) * u_bass_left  * u_stereo * 0.18;
  col += u_pal_low * exp(-length(uv_s - vec2(s_off * u_bass_right, 0.0)) * 4.5) * u_bass_right * u_stereo * 0.18;

  // ── Vignette ────────────────────────────────────────────
  vec2  vig_uv = uv_raw * 2.0 - 1.0;
  float vig    = 1.0 - smoothstep(0.5, 1.5, dot(vig_uv, vig_uv));
  col         *= vig;

  // ── Feedback ────────────────────────────────────────────
  vec2 fb  = uv_raw - 0.5;
  fb      /= u_fb_zoom;
  float co = cos(-u_fb_rotation), si = sin(-u_fb_rotation);
  fb       = vec2(fb.x * co - fb.y * si, fb.x * si + fb.y * co);
  fb.x    += sin(fb.y * 8.0 + u_time * 0.7) * u_fb_warp_x;
  fb.y    += cos(fb.x * 8.0 - u_time * 0.5) * u_fb_warp_y;
  vec2 fb_uv = fb + 0.5;
  vec2 ef    = smoothstep(vec2(0.0), vec2(0.04), fb_uv)
             * (vec2(1.0) - smoothstep(vec2(0.96), vec2(1.0), fb_uv));
  vec3 feedback = texture(u_prev_frame, clamp(fb_uv, 0.001, 0.999)).rgb
                * u_fb_decay * 0.35 * (ef.x * ef.y);

  col = feedback + col;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
