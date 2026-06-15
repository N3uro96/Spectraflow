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

float fold_angle(float a, float segments) {
  float seg = 6.28318 / max(segments, 2.0);
  float af = mod(a + seg * 0.5, seg) - seg * 0.5;
  return abs(af);
}

void main() {
  float d_segments    = floor(3.0 + hash_seed(u_seed,  1.0) * 13.0);
  float d_zoom        = 0.35 + hash_seed(u_seed,  2.0) * 1.3;
  float d_rotation    = (hash_seed(u_seed,  3.0) * 2.0 - 1.0) * 0.7;
  float d_fold_speed  = (hash_seed(u_seed,  4.0) * 2.0 - 1.0) * 0.4;
  float d_swirl       = (hash_seed(u_seed,  5.0) * 2.0 - 1.0) * 5.0;
  float d_bilateral   = hash_seed(u_seed,  6.0) > 0.45 ? 1.0 : 0.0;
  float d_double_fold = hash_seed(u_seed,  7.0) > 0.5 ? 1.0 : 0.0;
  float d_pattern     = hash_seed(u_seed,  8.0);
  float d_wave_freq   = 2.0 + hash_seed(u_seed,  9.0) * 10.0;
  float d_warp_x      = (hash_seed(u_seed, 10.0) - 0.5) * 2.2;
  float d_warp_y      = (hash_seed(u_seed, 11.0) - 0.5) * 2.2;
  float d_color_speed = 0.1 + hash_seed(u_seed, 12.0) * 2.0;
  float d_phase       = hash_seed(u_seed, 13.0) * 6.28318;
  float d_bass_react  = 0.3 + hash_seed(u_seed, 14.0) * 0.9;
  float d_mid_react   = 0.3 + hash_seed(u_seed, 15.0) * 0.9;
  float d_high_react  = 0.2 + hash_seed(u_seed, 16.0) * 0.9;
  float d_pulse_str   = 0.3 + hash_seed(u_seed, 17.0) * 1.2;
  float d_stereo_str  = 0.05 + hash_seed(u_seed, 18.0) * 0.35;
  float d_inner_r     = hash_seed(u_seed, 19.0) * 0.35;
  float d_ring_freq   = 1.5 + hash_seed(u_seed, 20.0) * 4.0;

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
  float stereo_rot = lr_diff * d_stereo_str * u_stereo;

  float rot = u_time * d_rotation * 0.12 + u_mid * d_mid_react * 0.35 + stereo_rot;
  float scale = d_zoom * (1.0 + u_bass * d_bass_react * 0.4) * (1.0 + beat_kick * d_pulse_str * 0.35);
  uv /= scale;

  float cr = cos(rot), sr = sin(rot);
  uv = vec2(uv.x * cr - uv.y * sr, uv.x * sr + uv.y * cr);

  float r = length(uv);
  float a = atan(uv.y, uv.x);

  float inner_mask = smoothstep(d_inner_r * 0.5, d_inner_r, r);

  float fold_off = d_phase + u_time * d_fold_speed * 0.08;
  a += fold_off;

  float af = fold_angle(a, d_segments);

  if (d_bilateral > 0.5) {
    float seg = 6.28318 / max(d_segments, 2.0);
    af = abs(mod(af * 2.0, seg) - seg * 0.5);
  }

  vec2 kuv = vec2(cos(af), sin(af)) * r;

  float r2 = length(kuv);
  float a2 = atan(kuv.y, kuv.x);
  a2 += r2 * d_swirl * 0.18 + u_mid * d_mid_react * 0.22;
  kuv = vec2(cos(a2), sin(a2)) * r2;

  if (d_double_fold > 0.5) {
    float r3 = length(kuv);
    float a3 = atan(kuv.y, kuv.x) + d_phase * 0.5;
    float af3 = fold_angle(a3, max(d_segments * 0.5, 2.0));
    vec2 kuv2 = vec2(cos(af3), sin(af3)) * r3;
    kuv = mix(kuv, kuv2, 0.55);
  }

  float mid_w = u_mid * d_mid_react * 0.18;
  kuv.x += sin(kuv.y * d_wave_freq + u_time * 0.55) * (d_warp_x + mid_w) * 0.18;
  kuv.y += cos(kuv.x * d_wave_freq * 0.7 - u_time * 0.42) * (d_warp_y + mid_w * 0.8) * 0.18;

  float ring_pos = fract(length(kuv) * d_ring_freq) - 0.5;
  float ring_w = 0.045 + u_high * d_high_react * 0.18;
  float rings = 1.0 - smoothstep(ring_w, ring_w + 0.18, abs(ring_pos));

  float gx = abs(fract(kuv.x * d_wave_freq * 0.5) - 0.5);
  float gy = abs(fract(kuv.y * d_wave_freq * 0.5) - 0.5);
  float grid = 1.0 - smoothstep(0.05, 0.20, min(gx, gy));
  float geo = max(rings, grid * 0.8);

  float p1 = sin(kuv.x * d_wave_freq * 0.5 + u_time * 0.65 + d_phase);
  float p2 = cos(kuv.y * d_wave_freq * 0.38 - u_time * 0.48);
  float p3 = sin(length(kuv) * d_wave_freq * 0.28 - u_time * 0.55);
  float p4 = cos((kuv.x + kuv.y) * d_wave_freq * 0.18 + u_time * 0.42);
  float organic = clamp(0.5 + (p1 * p2 + p3 * p4) * 0.38, 0.0, 1.0);

  float nr = fract(length(kuv) * d_ring_freq * 0.6) - 0.5;
  float ngx = fract(kuv.x * d_wave_freq * 0.45) - 0.5;
  float ngy = fract(kuv.y * d_wave_freq * 0.45) - 0.5;
  float neon = clamp(0.028 / (abs(nr) + 0.009), 0.0, 1.0)
             + clamp(0.018 / (abs(ngx) + 0.007), 0.0, 1.0) * 0.65
             + clamp(0.018 / (abs(ngy) + 0.007), 0.0, 1.0) * 0.65;
  neon = clamp(neon, 0.0, 1.0);

  float pattern;
  if (d_pattern < 0.5) {
    pattern = mix(geo, organic, d_pattern * 2.0);
  } else {
    pattern = mix(organic, neon, (d_pattern - 0.5) * 2.0);
  }

  pattern *= (1.0 + beat_kick * d_pulse_str * 0.3) * inner_mask;
  pattern = clamp(pattern, 0.0, 1.0);

  float hue_r = fract(length(kuv) * 0.18 * d_color_speed);
  float hue_a = fract(af / 3.14159 * 0.28 * d_color_speed);
  float hue_beat = fract(beat_count * 0.09 + d_phase / 6.28318);
  float hue = fract(hue_r + hue_a * 0.4 + hue_beat * 0.2);

  vec3 col = pal(hue) * pattern;
  col += u_pal_highlight * u_high * d_high_react * 0.22 * pattern;

  float glow = exp(-r * (1.6 - u_energy * 0.7));
  col += u_pal_low * glow * 0.28;
  col += u_pal_high * glow * beat_kick * 0.65;

  col += beat_kick * 0.055 * u_pal_highlight;

  vec2 uv_s = uv_raw * 2.0 - 1.0;
  uv_s.x *= u_width / u_height;
  float s_off = u_stereo * 0.045;
  col += u_pal_low * exp(-length(uv_s + vec2(s_off * u_bass_left,  0.0)) * 5.0) * u_bass_left  * u_stereo * 0.18;
  col += u_pal_low * exp(-length(uv_s - vec2(s_off * u_bass_right, 0.0)) * 5.0) * u_bass_right * u_stereo * 0.18;

  vec2 vig_uv = uv_raw * 2.0 - 1.0;
  float vig = 1.0 - smoothstep(0.5, 1.5, dot(vig_uv, vig_uv));
  col *= vig;

  col = feedback + col;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
