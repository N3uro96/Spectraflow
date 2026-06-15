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

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5);
}

void main() {
  float d_sides       = floor(3.0 + hash_seed(u_seed,  1.0) * 7.0);
  float d_cross_mix   = hash_seed(u_seed,  2.0);
  float d_speed       = 0.2 + hash_seed(u_seed,  3.0) * 1.6;
  float d_rotation    = (hash_seed(u_seed,  4.0) * 2.0 - 1.0) * 0.7;
  float d_twist       = (hash_seed(u_seed,  5.0) * 2.0 - 1.0) * 4.0;
  float d_bass_expand = 0.3 + hash_seed(u_seed,  6.0) * 0.8;
  float d_bass_speed  = hash_seed(u_seed,  7.0) * 0.7;
  float d_pattern_type= hash_seed(u_seed,  8.0);
  float d_wave_freq   = 2.0 + hash_seed(u_seed,  9.0) * 10.0;
  float d_warp_x      = (hash_seed(u_seed, 10.0) - 0.5) * 2.0;
  float d_warp_y      = (hash_seed(u_seed, 11.0) - 0.5) * 2.0;
  float d_color_speed = 0.1 + hash_seed(u_seed, 12.0) * 1.8;
  float d_phase       = hash_seed(u_seed, 13.0) * 6.28318;
  float d_fog_dense   = 0.3 + hash_seed(u_seed, 14.0) * 0.7;
  float d_pulse_str   = 0.4 + hash_seed(u_seed, 15.0) * 1.2;
  float d_mid_react   = 0.3 + hash_seed(u_seed, 16.0) * 0.9;
  float d_high_react  = 0.3 + hash_seed(u_seed, 17.0) * 0.9;
  float d_stereo_str  = 0.03 + hash_seed(u_seed, 18.0) * 0.18;
  float d_ring_freq   = 1.5 + hash_seed(u_seed, 19.0) * 4.0;
  float d_backward    = hash_seed(u_seed, 20.0) < 0.06 ? -1.0 : 1.0;

  vec2 uv_raw = FlutterFragCoord().xy / vec2(u_width, u_height);
  vec2 uv = uv_raw * 2.0 - 1.0;
  uv.x *= u_width / u_height;
  vec2 uv0 = uv;

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

  float r = length(uv);
  float angle = atan(uv.y, uv.x);

  angle += u_time * d_rotation * 0.12 + u_mid * d_mid_react * 0.28 + r * d_twist * 0.18;

  float seg = 6.28318 / max(d_sides, 2.0);
  float a_snap = mod(angle + seg * 0.5, seg) - seg * 0.5;
  float poly_r = cos(a_snap);
  float eff_r = mix(r, r / max(poly_r, 0.01), d_cross_mix);

  float z = 1.0 / max(eff_r, 0.001);
  z += u_bass * d_bass_expand * 1.8;
  z *= 1.0 + beat_kick * d_pulse_str * 0.4;

  float speed = d_speed + u_bass * d_bass_speed * 0.5;
  float u_t = z * 0.22 - u_time * speed * d_backward;
  float u_s = angle / 6.28318;

  float mid_boost = u_mid * d_mid_react * 0.2;
  u_t += sin(u_s * d_wave_freq + u_time * 0.5) * (d_warp_x + mid_boost) * 0.15;
  u_s += cos(u_t * d_wave_freq * 0.5 - u_time * 0.4) * (d_warp_y + mid_boost * 0.7) * 0.12;

  float shake = beat_kick * u_energy * 0.022;
  uv.x += (hash(vec2(u_time * 1.3, 0.2)) - 0.5) * shake;
  uv.y += (hash(vec2(0.2, u_time * 1.7)) - 0.5) * shake;

  float ring_pos = fract(u_t * d_ring_freq) - 0.5;
  float ring_thick = 0.05 + u_high * d_high_react * 0.2;
  float rings = 1.0 - smoothstep(ring_thick, ring_thick + 0.18, abs(ring_pos));

  float spoke_pos = fract(u_s * d_sides) - 0.5;
  float spoke_w = 0.04 + u_bass * 0.07;
  float spokes = 1.0 - smoothstep(spoke_w, spoke_w + 0.14, abs(spoke_pos));
  float geo = max(rings, spokes * 0.8);

  vec2 puv = vec2(u_t * 0.25, u_s * 6.28318);
  float p1 = sin(puv.x * d_wave_freq * 0.5 + u_time * 0.6 + d_phase);
  float p2 = cos(puv.y * d_wave_freq * 0.18 - u_time * 0.35);
  float p3 = sin(length(puv) * d_wave_freq * 0.15 - u_time * 0.5);
  float p4 = cos(puv.x * 0.3 + puv.y * 0.4 + u_time * 0.45);
  float organic = clamp(0.5 + (p1 * p2 + p3 * p4) * 0.35, 0.0, 1.0);

  float nr = fract(u_t * d_ring_freq * 0.5) - 0.5;
  float ns = fract(u_s * d_sides * 0.5) - 0.5;
  float neon = clamp(0.028 / (abs(nr) + 0.009), 0.0, 1.0)
             + clamp(0.018 / (abs(ns) + 0.007), 0.0, 1.0) * 0.75;
  neon = clamp(neon, 0.0, 1.0);

  float pattern;
  if (d_pattern_type < 0.5) {
    pattern = mix(geo, organic, d_pattern_type * 2.0);
  } else {
    pattern = mix(organic, neon, (d_pattern_type - 0.5) * 2.0);
  }

  pattern *= 1.0 + beat_kick * d_pulse_str * 0.35;

  float fog = smoothstep(0.0, 9.0, z) * d_fog_dense;
  pattern = clamp(pattern * (1.0 - fog), 0.0, 1.0);

  float hue_depth = fract(u_t * 0.09 * d_color_speed);
  float hue_angle = fract(u_s * 0.35 * d_color_speed);
  float hue_beat = fract(beat_count * 0.08 + d_phase / 6.28318);
  float hue = fract(hue_depth + hue_angle * 0.3 + hue_beat * 0.18);

  vec3 col = pal(hue) * pattern;
  col += u_pal_highlight * u_high * d_high_react * 0.2 * pattern;

  float glow = exp(-length(uv0) * (1.8 - u_energy * 0.7));
  col += u_pal_low * glow * 0.25;
  col += u_pal_high * glow * beat_kick * 0.65;

  col += beat_kick * 0.055 * u_pal_highlight;

  float s_off = u_stereo * 0.045;
  col += u_pal_low * exp(-length(uv0 + vec2(s_off * u_bass_left,  0.0)) * 5.0) * u_bass_left  * u_stereo * 0.2;
  col += u_pal_low * exp(-length(uv0 - vec2(s_off * u_bass_right, 0.0)) * 5.0) * u_bass_right * u_stereo * 0.2;

  vec2 vig_uv = uv_raw * 2.0 - 1.0;
  float vig = 1.0 - smoothstep(0.5, 1.5, dot(vig_uv, vig_uv));
  col *= vig;

  col = feedback + col;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
