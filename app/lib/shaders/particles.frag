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

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
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
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.0;
    a *= 0.5;
  }
  return v;
}

float particle(vec2 d, float r, float shape) {
  float l = length(d);
  float g1 = exp(-l * l / (r * r * 0.18));
  float g2 = exp(-pow(l - r * 0.7, 2.0) / (r * r * 0.05));
  float a = atan(d.y, d.x);
  float g3 = exp(-l / (r * (0.4 + 0.6 * abs(cos(a * shape)))));
  return max(g1, mix(g2, g3, 0.5));
}

float line_glow(vec2 a, vec2 b, vec2 p, float w) {
  vec2 ab = b - a;
  float len2 = max(dot(ab, ab), 0.0001);
  float t = clamp(dot(p - a, ab) / len2, 0.0, 1.0);
  return exp(-dot(p - (a + t * ab), p - (a + t * ab)) / (w * w));
}

void main() {
  float d_layer1_count  = floor(2.0 + hash_seed(u_seed,  1.0) * 4.0);
  float d_layer2_count  = floor(3.0 + hash_seed(u_seed,  2.0) * 7.0);
  float d_layer3_count  = floor(4.0 + hash_seed(u_seed,  3.0) * 9.0);
  float d_orbit_style   = hash_seed(u_seed,  4.0);
  float d_rotation      = (hash_seed(u_seed,  5.0) - 0.5) * 1.2;
  float d_warp_x        = (hash_seed(u_seed,  6.0) - 0.5) * 2.0;
  float d_warp_y        = (hash_seed(u_seed,  7.0) - 0.5) * 2.0;
  float d_color_speed   = 0.1 + hash_seed(u_seed,  8.0) * 1.8;
  float d_bass_react    = 0.4 + hash_seed(u_seed,  9.0) * 1.0;
  float d_mid_react     = 0.3 + hash_seed(u_seed, 10.0) * 0.9;
  float d_high_react    = 0.2 + hash_seed(u_seed, 11.0) * 0.9;
  float d_pulse_str     = 0.3 + hash_seed(u_seed, 12.0) * 1.2;
  float d_stereo_str    = 0.04 + hash_seed(u_seed, 13.0) * 0.22;
  float d_connect       = hash_seed(u_seed, 14.0);
  float d_glow_exp      = 0.8 + hash_seed(u_seed, 15.0) * 1.6;
  float d_shape         = floor(2.0 + hash_seed(u_seed, 16.0) * 9.0);
  float d_trail_str     = hash_seed(u_seed, 17.0) * 0.7;
  float d_zoom          = 0.7 + hash_seed(u_seed, 18.0) * 0.7;
  float d_phase         = hash_seed(u_seed, 19.0) * 6.28318;
  float d_field_drift   = hash_seed(u_seed, 20.0);

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
  float beat_phase = fract(u_time / beat_dur);
  float beat_kick = exp(-beat_phase * 8.0);

  float lr_diff = u_bass_right - u_bass_left;
  uv.x -= lr_diff * d_stereo_str * u_stereo;

  uv /= d_zoom * (1.0 + beat_kick * d_pulse_str * 0.08 + u_bass * 0.05);

  float rot = u_time * d_rotation * 0.1 + u_mid * d_mid_react * 0.2;
  float cr = cos(rot), sr = sin(rot);
  uv = vec2(uv.x * cr - uv.y * sr, uv.x * sr + uv.y * cr);

  vec2 uv0 = uv;

  float wb = 1.0 + u_energy * 2.0;
  uv.x += sin(uv.y * 3.0 + u_time * 0.6) * d_warp_x * 0.04 * wb;
  uv.y += cos(uv.x * 3.0 - u_time * 0.5) * d_warp_y * 0.04 * wb;

  vec3 col = vec3(0.0);

  // Layer 1: Micro particle field
  {
    float dens = (2.0 + d_layer1_count) * 1.4;
    vec2 guv = (uv + vec2(d_warp_x, d_warp_y) * u_time * 0.03) * dens;
    vec2 cid = floor(guv);
    vec2 cuv = fract(guv);
    float r = 0.35 / dens;
    for (int dx = -1; dx <= 1; dx++) {
      for (int dy = -1; dy <= 1; dy++) {
        vec2 nb = cid + vec2(float(dx), float(dy));
        vec2 h = hash21(nb + d_phase * 0.0005);
        vec3 h3 = hash33(vec3(nb, d_phase));
        float ang = h.x * 6.28318 + u_time * (0.2 + h.y * 0.3) * (d_rotation + 0.01);
        float rad = 0.08 + h.y * 0.18 + u_bass * d_bass_react * 0.08;
        vec2 p = vec2(0.5) + rad * vec2(cos(ang), sin(ang));
        p += (h3.xy - 0.5) * u_high * d_high_react * 0.15;
        vec2 delta = (cuv - (vec2(float(dx), float(dy)) + p)) / (dens * 0.5);
        float g = particle(delta, r * d_glow_exp, d_shape);
        float hue = h3.z + u_time * 0.04 * d_color_speed + d_phase / 6.28318;
        col += pal(fract(hue)) * g * (0.6 + u_energy * 0.5 + beat_kick * 0.4) * 0.5;
      }
    }
  }

  // Layer 2: Hero orbit particles
  vec2 hero_pos[12];
  vec3 hero_col[12];
  float hero_alive[12];
  int hero_n = int(min(d_layer2_count, 12.0));
  for (int i = 0; i < 12; i++) {
    hero_alive[i] = float(i) < d_layer2_count ? 1.0 : 0.0;
    if (hero_alive[i] < 0.5) continue;
    float fi = float(i);
    vec2 h = hash21(vec2(fi * 17.3, fi * 9.71) + d_phase * 0.003);
    float theta = fi / d_layer2_count * 6.28318 + h.x * 6.28318
                + u_time * (0.2 + h.y * 0.4) * d_rotation;
    theta += fi * d_phase * 0.1;
    float r = 0.25 + (fi / d_layer2_count) * 0.55 + u_bass * d_bass_react * 0.2;
    r *= 1.0 + beat_kick * d_pulse_str * 0.15;
    vec2 pos;
    if (d_orbit_style < 0.33) {
      pos = r * vec2(cos(theta), sin(theta));
    } else if (d_orbit_style < 0.66) {
      float k = 2.0 + floor(hash_seed(u_seed, 21.0) * 4.0);
      pos = r * abs(sin(k * theta)) * vec2(cos(theta), sin(theta));
    } else {
      pos = r * vec2(sin(2.0 * theta + d_phase), cos(3.0 * theta));
    }
    pos.x += (i % 2 == 0 ? u_bass_left : -u_bass_right) * u_stereo * d_stereo_str * 0.5;
    pos += (h - 0.5) * u_mid * d_mid_react * 0.15;
    hero_pos[i] = pos;
    float hue = fi / d_layer2_count + u_time * 0.05 * d_color_speed + d_phase / 6.28318;
    hero_col[i] = pal(fract(hue));
    float g = particle(uv - pos, 0.08 * d_glow_exp, d_shape) * 5.0 * hero_alive[i];
    float bri = 0.8 + u_energy * 0.5 + beat_kick * 0.5;
    col += hero_col[i] * g * bri;
  }

  // Connection lines
  if (d_connect > 0.4) {
    for (int i = 0; i < 12; i++) {
      if (hero_alive[i] < 0.5 || hero_alive[(i + 1) % 12] < 0.5) continue;
      int j = (i + 1) % 12;
      int k = (i + 3) % 12;
      if (hero_alive[k] > 0.5) {
        float ln = line_glow(hero_pos[i], hero_pos[k], uv, 0.015 * (1.0 + u_high * 0.5));
        col += mix(hero_col[i], hero_col[k], 0.5) * ln * 0.35 * d_connect;
      }
      float ln = line_glow(hero_pos[i], hero_pos[j], uv, 0.02 * (1.0 + u_mid * 0.3));
      col += mix(hero_col[i], hero_col[j], 0.5) * ln * 0.5 * d_connect;
    }
  }

  // Layer 3: Stereo field particles
  {
    float n = d_layer3_count;
    for (int i = 0; i < 16; i++) {
      if (float(i) >= n) break;
      float fi = float(i);
      vec2 h = hash21(vec2(fi * 11.7, fi * 5.43) + d_phase * 0.005);
      float side = fi < n * 0.5 ? -1.0 : 1.0;
      float y = (fract(fi / n + u_time * 0.08 + h.y * 0.2) * 2.0 - 1.0) * 0.85;
      float x = side * (0.35 + h.x * 0.45 + u_bass * d_bass_react * 0.2);
      x += (side > 0.0 ? u_bass_right : u_bass_left) * u_stereo * d_stereo_str * 0.8;
      float g = particle(uv - vec2(x, y), 0.06 * d_glow_exp, d_shape) * 3.0;
      float hue = fi / n + u_time * 0.06 * d_color_speed + (side > 0.0 ? 0.15 : 0.0);
      col += pal(fract(hue)) * g * (0.5 + u_energy * 0.5);
    }
  }

  // High frequency sparkle dust
  float dust = fbm(uv * 6.0 + u_time * 0.4) * fbm(uv * 9.0 - u_time * 0.3);
  col += u_pal_highlight * smoothstep(0.6, 0.9, dust) * u_high * d_high_react * 0.25;

  // Beat flash + stereo core glow
  col += beat_kick * 0.06 * u_pal_highlight;
  col += u_pal_low * exp(-length(uv0) * (2.5 - u_energy)) * 0.15;
  col *= 1.0 + u_energy * 0.25;

  vec2 vig_uv = uv_raw * 2.0 - 1.0;
  float vig = 1.0 - smoothstep(0.5, 1.5, dot(vig_uv, vig_uv));
  col *= vig;

  col = feedback + col;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
