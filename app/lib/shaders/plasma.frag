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

vec3 pal(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.333) return mix(u_pal_shadow, u_pal_low,       t * 3.0);
  if (t < 0.667) return mix(u_pal_low,    u_pal_high,      (t - 0.333) * 3.0);
                  return mix(u_pal_high,   u_pal_highlight, (t - 0.667) * 3.0);
}

float hash_seed(float seed, float salt) {
  return fract(sin(seed * 12.9898 + salt * 78.233) * 43758.5453);
}

float hash11(float p) {
  p = fract(p * 0.1031); p *= p + 33.33; return fract(p * (p + p));
}

vec2 hash21(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.xx + p.yx) * p.xy);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash11(dot(i, vec2(127.1, 311.7)));
  float b = hash11(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7)));
  float c = hash11(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7)));
  float d = hash11(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7)));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = rot * p * 2.0 + vec2(1.0);
    a *= 0.5;
  }
  return v;
}

void main() {
  float d_zoom        = 0.6 + hash_seed(u_seed,  1.0) * 0.9;
  float d_rotation    = (hash_seed(u_seed,  2.0) * 2.0 - 1.0) * 0.8;
  float d_warp_x      = (hash_seed(u_seed,  3.0) - 0.5) * 2.4;
  float d_warp_y      = (hash_seed(u_seed,  4.0) - 0.5) * 2.4;
  float d_wave_freq   = 1.0 + hash_seed(u_seed,  5.0) * 6.0;
  float d_color_speed = 0.1 + hash_seed(u_seed,  6.0) * 1.6;
  float d_layers      = floor(2.0 + hash_seed(u_seed,  7.0) * 7.0);
  float d_bass_react  = 0.4 + hash_seed(u_seed,  8.0) * 1.0;
  float d_mid_react   = 0.3 + hash_seed(u_seed,  9.0) * 0.9;
  float d_high_react  = 0.2 + hash_seed(u_seed, 10.0) * 0.9;
  float d_symmetry    = floor(1.0 + hash_seed(u_seed, 11.0) * 7.0);
  float d_color_style = hash_seed(u_seed, 12.0);
  float d_pulse_str   = 0.3 + hash_seed(u_seed, 13.0) * 1.2;
  float d_stereo_str  = 0.03 + hash_seed(u_seed, 14.0) * 0.18;
  float d_chaos       = hash_seed(u_seed, 15.0) * 0.7;
  float d_zoom_react  = hash_seed(u_seed, 16.0) * 0.5;
  float d_radial_mix  = hash_seed(u_seed, 17.0);
  float d_domain_warp = hash_seed(u_seed, 18.0) * 1.5;
  float d_phase       = hash_seed(u_seed, 19.0) * 6.28318;
  float d_inner_fade  = hash_seed(u_seed, 20.0) * 0.5;

  vec2 uv_raw = FlutterFragCoord().xy / vec2(u_width, u_height);
  vec2 uv = uv_raw * 2.0 - 1.0;
  uv.x *= u_width / u_height;

  vec2 fb = uv_raw - 0.5;
  fb /= u_fb_zoom;
  float co = cos(-u_fb_rotation), si = sin(-u_fb_rotation);
  fb = vec2(fb.x * co - fb.y * si, fb.x * si + fb.y * co);
  fb.x += sin(fb.y * 8.0 + u_time * 0.7) * u_fb_warp_x;
  fb.y += cos(fb.x * 8.0 - u_time * 0.5) * u_fb_warp_y;
  vec2 fb_uv = fb + 0.5;
  vec2 ef = smoothstep(vec2(0.0), vec2(0.04), fb_uv)
          * (vec2(1.0) - smoothstep(vec2(0.96), vec2(1.0), fb_uv));
  vec3 feedback = texture(u_prev_frame, clamp(fb_uv, 0.001, 0.999)).rgb
                * u_fb_decay * 0.35 * (ef.x * ef.y);

  float beat_dur = 60.0 / max(u_bpm, 60.0);
  float beat_count = floor(u_time / beat_dur);
  float beat_phase = fract(u_time / beat_dur);
  float beat_kick = exp(-beat_phase * 8.0);

  float lr_diff = u_bass_right - u_bass_left;
  uv.x -= lr_diff * d_stereo_str * u_stereo;

  uv /= d_zoom * (1.0 + u_bass * d_zoom_react * 0.25 + beat_kick * d_pulse_str * 0.06);

  float rot = u_time * d_rotation * 0.08 + u_mid * d_mid_react * 0.25;
  float cr = cos(rot), sr = sin(rot);
  uv = vec2(uv.x * cr - uv.y * sr, uv.x * sr + uv.y * cr);

  if (d_symmetry >= 2.0) {
    float r = length(uv);
    float a = atan(uv.y, uv.x);
    float seg = 6.28318 / d_symmetry;
    float af = mod(a + seg * 0.5 + d_phase * 0.1, seg) - seg * 0.5;
    uv = vec2(cos(abs(af)), sin(abs(af))) * r;
  }

  vec2 uv0 = uv;
  float dw = d_domain_warp * (1.0 + u_energy);
  for (int i = 0; i < 3; i++) {
    uv += dw * 0.05 * vec2(
      fbm(uv * d_wave_freq * 0.4 + u_time * 0.15 + float(i)),
      fbm(uv * d_wave_freq * 0.4 - u_time * 0.12 + float(i) + 10.0)
    );
  }

  float tm = u_time * (0.4 + abs(d_rotation) * 0.4) + u_mid * d_mid_react * 0.3;
  float ba = 1.0 + u_bass * d_bass_react * 1.8;
  float wf = d_wave_freq * 0.12;
  float bf = (1.4 + d_zoom) * (1.0 + u_high * d_high_react * 1.5);

  float p = 0.0;
  float tw = 0.0;
  float w;

  vec2 wx = normalize(vec2(1.0, 0.0) + vec2( d_warp_x,  d_warp_y) * 0.22);
  vec2 wy = normalize(vec2(0.0, 1.0) + vec2(-d_warp_y,  d_warp_x) * 0.22);
  vec2 wd1 = normalize(vec2(0.707,  0.707) + vec2( d_warp_x, -d_warp_y) * 0.18);
  vec2 wd2 = normalize(vec2(-0.707, 0.707) + vec2( d_warp_y,  d_warp_x) * 0.18);

  float n = d_layers;
  w = 1.0; p += w * sin(dot(uv, wx) * bf * 2.0 + tm + d_phase); tw += w;
  w = clamp(n - 1.0, 0.0, 1.0); p += w * sin(dot(uv, wy) * bf * 1.75 + tm * 0.80 + d_phase * 1.31) * ba; tw += w;
  w = clamp(n - 2.0, 0.0, 1.0); p += w * sin(dot(uv, wd1) * bf * 2.3 + tm * 1.20 + d_phase * 0.71) * ba; tw += w;
  w = clamp(n - 3.0, 0.0, 1.0); p += w * sin(length(uv - vec2(d_warp_x, d_warp_y) * 0.4) * bf * 1.6 + tm * 0.65 + d_phase * 1.73); tw += w;
  w = clamp(n - 4.0, 0.0, 1.0); p += w * sin(dot(uv, wd2) * bf * (2.0 + wf) + tm * 1.40 + d_phase * 2.09) * ba; tw += w;
  w = clamp(n - 5.0, 0.0, 1.0); p += w * sin(length(uv + vec2(-d_warp_y, d_warp_x) * 0.3) * bf * (1.85 + wf) + tm * 0.90 + d_phase * 0.43); tw += w;
  w = clamp(n - 6.0, 0.0, 1.0); float ang = atan(uv.y, uv.x); p += w * sin(ang * (2.5 + d_wave_freq) + length(uv) * bf + tm * 0.50 + d_phase * 3.00); tw += w;
  w = clamp(n - 7.0, 0.0, 1.0); p += w * sin(uv.x * uv.y * bf * 2.8 + tm * 1.10 + d_phase * 1.94) * ba; tw += w;
  w = clamp(n - 8.0, 0.0, 1.0); p += w * sin(dot(uv, vec2(0.866, 0.5)) * bf * 3.2 + tm * 0.75 + d_phase * 2.55) * ba; tw += w;

  p += d_chaos * sin(uv.x * bf * 5.0 + tm * 1.8 + d_phase * 0.33) * ba * 0.5;
  p += d_chaos * cos(uv.y * bf * 4.2 - tm * 2.1 + d_phase * 1.17) * ba * 0.5;
  tw += d_chaos;

  p += d_radial_mix * sin(length(uv) * bf * 2.0 - tm * 0.6 + d_phase) * ba;
  tw += d_radial_mix;

  p = p / max(tw, 0.001);
  float plasma = p * 0.5 + 0.5;

  float inner = smoothstep(d_inner_fade, 0.0, length(uv0));
  plasma = mix(plasma, 0.0, inner * 0.7);

  float hue = plasma + u_time * 0.06 * d_color_speed + d_phase / 6.28318 + beat_count * 0.08;
  hue += u_bass * d_bass_react * 0.12;
  float bri = clamp(0.2 + plasma * 0.8 + u_energy * 0.35 + beat_kick * 0.12, 0.0, 1.0);
  bri += u_high * d_high_react * 0.2 * plasma;

  vec3 col;
  if (d_color_style < 0.33) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 hsvp = abs(fract(vec3(hue) + K.xyz) * 6.0 - K.www);
    col = bri * mix(K.xxx, clamp(hsvp - K.xxx, 0.0, 1.0), 1.0);
  } else if (d_color_style < 0.66) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 hsvp = abs(fract(vec3(hue) + K.xyz) * 6.0 - K.www);
    vec3 hsv = bri * mix(K.xxx, clamp(hsvp - K.xxx, 0.0, 1.0), 1.0);
    vec3 tint = pal(fract(plasma * 0.7 + u_time * 0.02 * d_color_speed));
    col = mix(hsv, hsv * tint * 2.0, 0.45);
  } else {
    col = pal(fract(hue)) * bri;
    col += pal(fract(hue + 0.5)) * (1.0 - plasma) * bri * 0.5;
  }

  col += beat_kick * 0.08 * u_pal_highlight * bri;
  col *= 1.0 + u_energy * 0.35;

  vec2 uv_s = uv_raw * 2.0 - 1.0;
  uv_s.x *= u_width / u_height;
  float s_off = u_stereo * 0.035;
  col += u_pal_low * exp(-length(uv_s + vec2(s_off * u_bass_left,  0.0)) * 4.5) * u_bass_left  * u_stereo * 0.18;
  col += u_pal_low * exp(-length(uv_s - vec2(s_off * u_bass_right, 0.0)) * 4.5) * u_bass_right * u_stereo * 0.18;

  vec2 vig_uv = uv_raw * 2.0 - 1.0;
  float vig = 1.0 - smoothstep(0.5, 1.5, dot(vig_uv, vig_uv));
  col *= vig;

  col = feedback + col;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
