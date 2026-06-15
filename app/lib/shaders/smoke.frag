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

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = dot(i, vec3(127.1, 311.7, 74.7));
  float a = hash11(n);
  float b = hash11(n + 127.1);
  float c = hash11(n + 311.7);
  float d = hash11(n + 438.8);
  float e = hash11(n + 74.7);
  float g = hash11(n + 201.5);
  float h = hash11(n + 329.2);
  float k = hash11(n + 456.1);
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
             mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
}

float fbm3(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise3(p);
    p = p * 2.0 + vec3(3.0, 1.0, 2.0);
    a *= 0.5;
  }
  return v;
}

void main() {
  float d_scale      = 0.8 + hash_seed(u_seed,  1.0) * 1.4;
  float d_rotation   = (hash_seed(u_seed,  2.0) * 2.0 - 1.0) * 0.4;
  float d_warp_x     = (hash_seed(u_seed,  3.0) - 0.5) * 1.6;
  float d_warp_y     = (hash_seed(u_seed,  4.0) - 0.5) * 1.6;
  float d_flow_speed = 0.05 + hash_seed(u_seed,  5.0) * 0.25;
  float d_color_speed= 0.05 + hash_seed(u_seed,  6.0) * 0.25;
  float d_turbulence = 0.5 + hash_seed(u_seed,  7.0) * 2.0;
  float d_bass_react = 0.4 + hash_seed(u_seed,  8.0) * 1.0;
  float d_mid_react  = 0.3 + hash_seed(u_seed,  9.0) * 0.9;
  float d_high_react = 0.2 + hash_seed(u_seed, 10.0) * 0.9;
  float d_pulse_str  = 0.3 + hash_seed(u_seed, 11.0) * 1.2;
  float d_stereo_str = 0.03 + hash_seed(u_seed, 12.0) * 0.18;
  float d_style      = hash_seed(u_seed, 13.0);
  float d_detail     = 0.6 + hash_seed(u_seed, 14.0) * 1.4;
  float d_veins      = hash_seed(u_seed, 15.0);
  float d_fog_dense  = 0.2 + hash_seed(u_seed, 16.0) * 0.8;
  float d_vorticity  = (hash_seed(u_seed, 17.0) - 0.5) * 2.0;
  float d_phase      = hash_seed(u_seed, 18.0) * 6.28318;
  float d_brightness = 0.8 + hash_seed(u_seed, 19.0) * 0.7;
  float d_zoom_react = hash_seed(u_seed, 20.0) * 0.4;

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
                * u_fb_decay * 0.45 * (ef.x * ef.y);

  float beat_dur = 60.0 / max(u_bpm, 60.0);
  float beat_phase = fract(u_time / beat_dur);
  float beat_kick = exp(-beat_phase * 8.0);

  float lr_diff = u_bass_right - u_bass_left;
  uv.x -= lr_diff * d_stereo_str * u_stereo;

  uv /= d_scale * (1.0 + u_bass * d_zoom_react * 0.3 + beat_kick * d_pulse_str * 0.08);

  float rot = u_time * d_rotation * 0.08 + u_mid * d_mid_react * 0.15;
  float cr = cos(rot), sr = sin(rot);
  uv = vec2(uv.x * cr - uv.y * sr, uv.x * sr + uv.y * cr);

  vec2 uv0 = uv;
  float wb = 1.0 + u_energy * 1.5;
  uv.x += sin(uv.y * 2.0 + u_time * 0.3) * d_warp_x * 0.05 * wb;
  uv.y += cos(uv.x * 2.0 - u_time * 0.25) * d_warp_y * 0.05 * wb;

  float t = u_time * d_flow_speed;
  vec3 p = vec3(uv * d_detail, t);

  float turb = fbm3(p);
  for (int i = 0; i < 3; i++) {
    vec3 off = vec3(
      fbm3(p + vec3(5.2, 1.3, 0.0)),
      fbm3(p + vec3(9.2, 2.7, 0.0)),
      fbm3(p + vec3(1.7, 8.3, 0.0))
    );
    p += off * d_turbulence * 0.12;
  }

  float smoke = fbm3(p);
  float smoke2 = fbm3(p * 1.7 + vec3(0.0, 0.0, t * 0.5));
  float smoke3 = fbm3(p * 2.5 + vec3(7.0, 3.0, -t * 0.3));

  float density = smoothstep(0.25, 0.75, smoke) * (0.6 + u_energy * 0.5);
  density += smoothstep(0.4, 0.9, smoke2) * (0.3 + u_bass * d_bass_react * 0.5);
  density += smoothstep(0.5, 0.95, smoke3) * u_high * d_high_react * 0.4;

  float hue = smoke * 0.6 + smoke2 * 0.25 + u_time * d_color_speed + d_phase / 6.28318;
  hue += u_bass * d_bass_react * 0.1;

  vec3 col;
  if (d_style < 0.33) {
    col = pal(fract(hue)) * density;
  } else if (d_style < 0.66) {
    col = mix(u_pal_shadow * 0.3, pal(fract(hue + smoke * 0.3)), density);
  } else {
    col = mix(u_pal_shadow * 0.15, u_pal_highlight, smoothstep(0.3, 0.9, density));
    col += pal(fract(hue + 0.5)) * density * 0.5;
  }

  if (d_veins > 0.5) {
    float veins = abs(smoke - smoke2) * 3.0;
    veins = smoothstep(0.1, 0.5, veins);
    col += u_pal_low * veins * (0.3 + u_mid * d_mid_react * 0.5);
  }

  float fog = exp(-length(uv0) * (1.2 + d_fog_dense));
  col *= fog;

  col += u_pal_low * exp(-length(uv0 + vec2(0.08 * u_bass_left * u_stereo, 0.0)) * 4.0) * u_bass_left * u_stereo * 0.2;
  col += u_pal_low * exp(-length(uv0 - vec2(0.08 * u_bass_right * u_stereo, 0.0)) * 4.0) * u_bass_right * u_stereo * 0.2;

  col += beat_kick * 0.06 * u_pal_highlight;
  col *= d_brightness;

  vec2 vig_uv = uv_raw * 2.0 - 1.0;
  float vig = 1.0 - smoothstep(0.5, 1.5, dot(vig_uv, vig_uv));
  col *= vig;

  col = feedback + col;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
