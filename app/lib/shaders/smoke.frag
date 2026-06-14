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

float neon_glow(float x, float w) { return w / (abs(x) + 0.004); }

float hash_seed(float seed, float salt) {
  return fract(sin(seed * 12.9898 + salt * 78.233) * 43758.5453);
}

// ── Mode 0: Neon-Gitter-Tunnel ────────────────────────────
float neon_grid(vec2 uv, float zoff, float d_zoom, float d_rot, float d_warp_x,
                float d_warp_y, float d_wfreq, float d_br, float d_mr,
                float d_spokes, float d_back, float d_rfreq, float d_ph) {
  float r = max(length(uv) - u_bass * 0.18 * d_br, 0.001);
  float a = atan(uv.y, uv.x);
  a += u_time * d_rot * 0.5 + u_mid * 0.7 * d_mr;
  float z  = 1.0 / r;
  float zs = u_time * (1.0 + d_zoom + u_energy * 3.5) * d_back + zoff;
  vec2 tuv = vec2(a * d_spokes / 6.28318, (z + zs) * 0.16 * d_rfreq);
  tuv.x   += sin(tuv.y * d_wfreq * 0.25 + u_time * 0.3 + d_ph) * d_warp_x * 0.06;
  tuv.y   += cos(tuv.x * d_wfreq * 0.25 - u_time * 0.2) * d_warp_y * 0.05;
  vec2 g   = fract(tuv) - 0.5;
  float w  = 0.012 + u_high * d_br * 0.06;
  return neon_glow(g.x, w) + neon_glow(g.y, w * 0.65);
}

// ── Mode 1: Hexagonaler Draht-Tunnel ─────────────────────
float hex_wire(vec2 uv, float zoff, float d_zoom, float d_rot, float d_br,
               float d_mr, float d_back, float d_rfreq) {
  float r = max(length(uv), 0.001);
  float a = atan(uv.y, uv.x);
  a += u_time * d_rot * 0.4 + u_mid * 0.6 * d_mr;
  float seg    = 6.28318 / 6.0;
  float a_snap = mod(a + seg * 0.5, seg) - seg * 0.5;
  float poly_r = cos(a_snap);
  float eff_r  = r / max(poly_r * mix(0.6, 1.0, 0.7), 0.01);
  float z      = 1.0 / max(eff_r, 0.001);
  float zs     = u_time * (1.2 + d_zoom + u_energy * 3.0) * d_back + zoff;
  float u_t    = (z + zs) * 0.2 * d_rfreq;
  float u_s    = a_snap / seg;
  vec2  grid   = fract(vec2(u_s * 3.0, u_t)) - 0.5;
  float w      = 0.011 + u_high * d_br * 0.05;
  return neon_glow(grid.x, w) + neon_glow(grid.y, w);
}

// ── Mode 2: Sternen-Burst (Speichen + Ringe) ─────────────
float star_burst(vec2 uv, float d_spokes, float d_rot, float d_br, float d_rfreq,
                 float d_back, float d_zoom) {
  float r = max(length(uv), 0.001);
  float a = atan(uv.y, uv.x);
  a += u_time * d_rot * 0.35;
  float spk  = fract(a * d_spokes / 6.28318) - 0.5;
  float ring = fract(r * d_rfreq * 3.5 - u_time * d_zoom * 0.8 * d_back) - 0.5;
  float w    = 0.014 + u_high * d_br * 0.07;
  return neon_glow(spk, w * 0.9) + neon_glow(ring, w);
}

void main() {
  // ════════════════════════════════════════════════════════
  // DNA — 20 Parameter
  // ════════════════════════════════════════════════════════
  float d_zoom       = 0.7  + hash_seed(u_seed,  1.0) * 0.7;
  float d_rotation   = (0.4 + hash_seed(u_seed,  2.0) * 1.6)
                     * (hash_seed(u_seed, 3.0) > 0.5 ? 1.0 : -1.0);
  float d_warp_x     = (hash_seed(u_seed,  4.0) - 0.5) * 1.4;
  float d_warp_y     = (hash_seed(u_seed,  5.0) - 0.5) * 1.4;
  float d_wave_freq  = 1.0  + hash_seed(u_seed,  6.0) * 7.0;
  float d_color_speed= 0.2  + hash_seed(u_seed,  7.0) * 2.3;
  float d_spokes     = floor(3.0 + hash_seed(u_seed,  8.0) * 7.0); // 3–9
  float d_bass_react = 0.3  + hash_seed(u_seed,  9.0) * 0.7;
  float d_mid_react  = 0.3  + hash_seed(u_seed, 10.0) * 0.7;
  float d_phase      = hash_seed(u_seed, 11.0) * 6.28318;
  // ── Neue Parameter ──────────────────────────────────────
  float d_style      = hash_seed(u_seed, 12.0);               // 0=grid, 0.5=hex, 1=star
  float d_pulse_str  = 0.3  + hash_seed(u_seed, 13.0) * 1.2;
  float d_stereo_str = 0.03 + hash_seed(u_seed, 14.0) * 0.15;
  float d_high_react = 0.2  + hash_seed(u_seed, 15.0) * 0.8;
  float d_rgb_str    = hash_seed(u_seed, 16.0) * 0.10;        // chrom. Aberration
  float d_backward   = hash_seed(u_seed, 17.0) < 0.10 ? -1.0 : 1.0;
  float d_line_thick = 0.8  + hash_seed(u_seed, 18.0) * 1.0; // Multiplikator
  float d_fog        = 0.2  + hash_seed(u_seed, 19.0) * 0.8;
  float d_ring_freq  = 1.5  + hash_seed(u_seed, 20.0) * 5.0;

  // ── UV Setup ────────────────────────────────────────────
  vec2 uv_raw = FlutterFragCoord().xy / vec2(u_width, u_height);
  vec2 uv     = uv_raw * 2.0 - 1.0;
  uv.x       *= u_width / u_height;

  // ── Stereo: Fluchtpunkt verschieben ─────────────────────
  float lr_diff = u_bass_right - u_bass_left;
  uv.x -= lr_diff * d_stereo_str * u_stereo;

  // ── Beat ────────────────────────────────────────────────
  float beat_dur   = 60.0 / max(u_bpm, 60.0);
  float beat_count = floor(u_time / beat_dur);
  float beat_phase = fract(u_time / beat_dur);
  float beat_kick  = exp(-beat_phase * 9.0);

  // ── Camera Shake ────────────────────────────────────────
  float shake = exp(-beat_phase * 5.0) * u_energy * 0.04 * d_bass_react;
  uv.x += (fract(sin(u_time * 112.3) * 43758.5) - 0.5) * shake;
  uv.y += (fract(cos(u_time *  73.1) * 43758.5) - 0.5) * shake;

  // ── Warp ────────────────────────────────────────────────
  float wb = 1.0 + u_energy * 2.5;
  uv.x += sin(uv.y * d_wave_freq + u_time * 0.5) * d_warp_x * wb * 0.04;
  uv.y += cos(uv.x * d_wave_freq - u_time * 0.5) * d_warp_y * wb * 0.04;

  // ── Beat-Puls: Zoom ──────────────────────────────────────
  uv /= 1.0 + beat_kick * d_pulse_str * 0.12;

  // ── Drei Stil-Modi, geblended über d_style ────────────────
  float w0 = clamp(1.0 - d_style * 3.0, 0.0, 1.0);
  float w1 = clamp(d_style * 3.0 - 0.0, 0.0, 1.0) * clamp(2.0 - d_style * 3.0, 0.0, 1.0);
  float w2 = clamp(d_style * 3.0 - 1.0, 0.0, 1.0);

  // Chromatic Aberration
  float rgb_s = d_rgb_str * (1.0 + u_bass * 0.5);

  float lines_r, lines_g, lines_b;
  if (d_style < 0.4) {
    lines_r = neon_grid(uv*(1.0 - rgb_s), 0.00, d_zoom, d_rotation, d_warp_x, d_warp_y, d_wave_freq, d_bass_react, d_mid_react, d_spokes, d_backward, d_ring_freq, d_phase);
    lines_g = neon_grid(uv,               0.05, d_zoom, d_rotation, d_warp_x, d_warp_y, d_wave_freq, d_bass_react, d_mid_react, d_spokes, d_backward, d_ring_freq, d_phase);
    lines_b = neon_grid(uv*(1.0 + rgb_s), 0.10, d_zoom, d_rotation, d_warp_x, d_warp_y, d_wave_freq, d_bass_react, d_mid_react, d_spokes, d_backward, d_ring_freq, d_phase);
  } else if (d_style < 0.7) {
    lines_r = hex_wire(uv*(1.0 - rgb_s), 0.00, d_zoom, d_rotation, d_bass_react, d_mid_react, d_backward, d_ring_freq);
    lines_g = hex_wire(uv,               0.05, d_zoom, d_rotation, d_bass_react, d_mid_react, d_backward, d_ring_freq);
    lines_b = hex_wire(uv*(1.0 + rgb_s), 0.10, d_zoom, d_rotation, d_bass_react, d_mid_react, d_backward, d_ring_freq);
  } else {
    lines_r = star_burst(uv*(1.0 - rgb_s), d_spokes, d_rotation, d_bass_react, d_ring_freq, d_backward, d_zoom);
    lines_g = star_burst(uv,               d_spokes, d_rotation, d_bass_react, d_ring_freq, d_backward, d_zoom);
    lines_b = star_burst(uv*(1.0 + rgb_s), d_spokes, d_rotation, d_bass_react, d_ring_freq, d_backward, d_zoom);
  }

  lines_r = clamp(lines_r * d_line_thick * 0.09, 0.0, 1.0);
  lines_g = clamp(lines_g * d_line_thick * 0.09, 0.0, 1.0);
  lines_b = clamp(lines_b * d_line_thick * 0.09, 0.0, 1.0);

  // ── Farbe ───────────────────────────────────────────────
  float hue   = fract(u_time * 0.04 * d_color_speed + d_phase / 6.28318 + beat_count * 0.07);
  vec3 col_b  = pal(fract(hue));
  vec3 bass_c = u_pal_highlight * u_bass * d_bass_react;
  vec3 grid_c = col_b + bass_c;

  vec3 new_content = vec3(grid_c.r * lines_r, grid_c.g * lines_g, grid_c.b * lines_b);

  // High → Glitzern
  new_content += u_pal_highlight * u_high * d_high_react * 0.06
               * max(lines_r, max(lines_g, lines_b));

  // ── Kern-Glow ────────────────────────────────────────────
  float glow = exp(-length(uv) * (3.2 - u_energy * 1.8));
  new_content += u_pal_high * u_energy * 1.8 * glow;
  new_content += u_pal_highlight * beat_kick * glow;

  // ── Stereo-Bögen ────────────────────────────────────────
  float s_off = u_stereo * 0.035;
  new_content += u_pal_low * exp(-length(uv + vec2( s_off * u_bass_left,  0.0)) * 4.5) * u_bass_left  * u_stereo * 0.25;
  new_content += u_pal_low * exp(-length(uv - vec2( s_off * u_bass_right, 0.0)) * 4.5) * u_bass_right * u_stereo * 0.25;

  // ── Tiefenfog ───────────────────────────────────────────
  float z_fog = 1.0 / max(length(uv) - u_bass * 0.15, 0.001);
  new_content  = mix(new_content, vec3(0.0), smoothstep(0.0, 6.0, z_fog) * d_fog * 0.6);

  // ── Beat-Flash ──────────────────────────────────────────
  new_content += beat_kick * 0.08 * u_pal_highlight;

  // ── Vignette ────────────────────────────────────────────
  vec2  vig_uv = uv_raw * 2.0 - 1.0;
  float vig    = 1.0 - smoothstep(0.5, 1.5, dot(vig_uv, vig_uv));
  new_content *= vig;

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
                * u_fb_decay * 0.60 * (ef.x * ef.y);

  vec3 col = feedback + new_content;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
