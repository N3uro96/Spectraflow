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

vec2 complexSqr(vec2 z) {
  return vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
}

float mandelbrot(vec2 c, int maxIter) {
  vec2 z = vec2(0.0);
  float iter = 0.0;
  for (int i = 0; i < 200; i++) {
    if (i >= maxIter) break;
    z = complexSqr(z) + c;
    if (dot(z, z) > 4.0) break;
    iter += 1.0;
  }
  if (iter >= float(maxIter)) return 0.0;
  float logZn = log(dot(z, z)) * 0.5;
  float nu = log(logZn / log(2.0)) / log(2.0);
  return (iter + 1.0 - nu) / float(maxIter);
}

float julia(vec2 z, vec2 c, int maxIter) {
  float iter = 0.0;
  for (int i = 0; i < 200; i++) {
    if (i >= maxIter) break;
    z = complexSqr(z) + c;
    if (dot(z, z) > 4.0) break;
    iter += 1.0;
  }
  if (iter >= float(maxIter)) return 0.0;
  float logZn = log(dot(z, z)) * 0.5;
  float nu = log(logZn / log(2.0)) / log(2.0);
  return (iter + 1.0 - nu) / float(maxIter);
}

float burningShip(vec2 c, int maxIter) {
  vec2 z = vec2(0.0);
  float iter = 0.0;
  for (int i = 0; i < 200; i++) {
    if (i >= maxIter) break;
    z = complexSqr(vec2(abs(z.x), abs(z.y))) + c;
    if (dot(z, z) > 4.0) break;
    iter += 1.0;
  }
  if (iter >= float(maxIter)) return 0.0;
  float logZn = log(dot(z, z)) * 0.5;
  float nu = log(logZn / log(2.0)) / log(2.0);
  return (iter + 1.0 - nu) / float(maxIter);
}

float orbit_trap(vec2 z, vec2 c, int maxIter) {
  float trap = 100.0;
  for (int i = 0; i < 200; i++) {
    if (i >= maxIter) break;
    z = complexSqr(z) + c;
    trap = min(trap, abs(length(z) - 1.0));
    if (dot(z, z) > 4.0) break;
  }
  return trap;
}

void main() {
  float d_fractal_type = hash_seed(u_seed,  1.0);
  float d_zoom_speed   = 0.05 + hash_seed(u_seed,  2.0) * 0.4;
  float d_center_x     = (hash_seed(u_seed,  3.0) - 0.5) * 1.8;
  float d_center_y     = (hash_seed(u_seed,  4.0) - 0.5) * 1.8;
  float d_julia_x      = (hash_seed(u_seed,  5.0) - 0.5) * 1.6;
  float d_julia_y      = (hash_seed(u_seed,  6.0) - 0.5) * 1.6;
  float d_color_speed  = 0.1 + hash_seed(u_seed,  7.0) * 1.2;
  float d_color_offset = hash_seed(u_seed,  8.0);
  float d_bass_react   = 0.3 + hash_seed(u_seed,  9.0) * 0.9;
  float d_mid_react    = 0.3 + hash_seed(u_seed, 10.0) * 0.9;
  float d_high_react   = 0.3 + hash_seed(u_seed, 11.0) * 0.9;
  float d_base_iter    = 30.0 + hash_seed(u_seed, 12.0) * 50.0;
  float d_max_iter     = 60.0 + hash_seed(u_seed, 13.0) * 120.0;
  float d_stereo_str   = 0.02 + hash_seed(u_seed, 14.0) * 0.18;
  float d_rotation     = (hash_seed(u_seed, 15.0) - 0.5) * 0.5;
  float d_zoom_warp    = hash_seed(u_seed, 16.0) * 0.5;
  float d_pulse_str    = 0.1 + hash_seed(u_seed, 17.0) * 0.5;
  float d_detail_amp   = 0.5 + hash_seed(u_seed, 18.0) * 1.5;
  float d_phase        = hash_seed(u_seed, 19.0) * 6.28318;
  float d_hue_shift    = hash_seed(u_seed, 20.0);

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
  float pulse = 1.0 + beat_kick * d_pulse_str;

  float zoom = exp(u_time * d_zoom_speed * (1.0 + u_energy * 0.3));
  zoom *= (1.0 + u_bass * d_bass_react * 0.2) * pulse;

  float lr_diff = u_bass_right - u_bass_left;
  vec2 center = vec2(d_center_x, d_center_y);
  center.x += lr_diff * d_stereo_str * u_stereo;
  center.y += (u_bass_left + u_bass_right - 1.0) * d_stereo_str * 0.3 * u_stereo;

  float angle = u_time * d_rotation * 0.1 + u_mid * d_mid_react * 0.05;
  float cr = cos(angle), sr = sin(angle);
  uv = vec2(uv.x * cr - uv.y * sr, uv.x * sr + uv.y * cr);

  vec2 c_plane = uv / zoom + center;
  c_plane += vec2(
    sin(c_plane.y * 3.0 + u_time) * d_zoom_warp * u_bass * d_bass_react,
    cos(c_plane.x * 3.0 - u_time) * d_zoom_warp * u_bass * d_bass_react
  );

  float iter_f = d_base_iter + (d_max_iter - d_base_iter) * u_high * d_high_react;
  int maxIter = int(iter_f);

  float fractal_val;
  float trap_val = 0.0;
  vec2 julia_c = vec2(d_julia_x, d_julia_y);
  julia_c += vec2(
    cos(u_time * 0.1 + d_phase) * 0.15,
    sin(u_time * 0.13 + d_phase) * 0.15
  ) * (1.0 + u_mid * d_mid_react);

  if (d_fractal_type < 0.35) {
    fractal_val = mandelbrot(c_plane, maxIter);
  } else if (d_fractal_type < 0.70) {
    fractal_val = julia(c_plane, julia_c, maxIter);
  } else {
    fractal_val = burningShip(c_plane, maxIter);
  }

  if (d_fractal_type > 0.85) {
    trap_val = orbit_trap(c_plane, julia_c, maxIter);
  }

  float hue = fractal_val * d_color_speed + u_time * 0.03 * d_color_speed
            + d_color_offset + d_hue_shift;
  hue += u_bass * d_bass_react * 0.1;

  vec3 col = pal(fract(hue));

  if (trap_val > 0.0) {
    col += u_pal_highlight * (1.0 - smoothstep(0.0, 0.3, trap_val)) * 0.5;
  }

  float contrast = d_detail_amp * (1.0 + u_high * d_high_react * 0.5);
  col = (col - 0.5) * contrast + 0.5;

  if (fractal_val <= 0.001) {
    col = mix(col, u_pal_shadow, 0.7);
    col += u_pal_low * u_energy * 0.2;
  }

  float glow = smoothstep(0.0, 0.3, fractal_val) * (1.0 - smoothstep(0.3, 0.6, fractal_val));
  col += u_pal_highlight * glow * 0.25;

  col += beat_kick * 0.04 * u_pal_highlight;

  float s_off = u_stereo * 0.04;
  vec2 uv_centered = uv_raw * 2.0 - 1.0;
  uv_centered.x *= u_width / u_height;
  col += u_pal_low * exp(-length(uv_centered + vec2(s_off * u_bass_left,  0.0)) * 5.0) * u_bass_left  * u_stereo * 0.12;
  col += u_pal_low * exp(-length(uv_centered - vec2(s_off * u_bass_right, 0.0)) * 5.0) * u_bass_right * u_stereo * 0.12;

  vec2 vig_uv = uv_raw * 2.0 - 1.0;
  float vig = 1.0 - smoothstep(0.5, 1.5, dot(vig_uv, vig_uv));
  col *= vig;

  col = feedback + col;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
