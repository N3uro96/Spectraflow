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

vec2 rot2d(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// ── Schachbrett-Varianten ─────────────────────────────────
float board_classic(vec2 uv, float freq) {
  vec2 grid = floor(uv * freq);
  return mod(grid.x + grid.y, 2.0);
}

float board_smooth(vec2 uv, float freq) {
  vec2 g = fract(uv * freq) - 0.5;
  float chess = mod(floor(uv.x * freq) + floor(uv.y * freq), 2.0);
  float edge = smoothstep(0.0, 0.15, abs(g.x)) * smoothstep(0.0, 0.15, abs(g.y));
  return mix(chess, 1.0 - chess, edge * 0.3);
}

float board_diagonal(vec2 uv, float freq) {
  float d = uv.x + uv.y;
  float cells = floor(d * freq) + floor((uv.x - uv.y) * freq * 0.5);
  return mod(cells, 2.0);
}

float board_radial(vec2 uv, float freq) {
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  float cells = floor(r * freq) + floor(a * freq * 0.3);
  return mod(cells, 2.0);
}

float board_tunnel(vec2 uv, float freq) {
  float r = length(uv);
  r = max(r, 0.001);
  float z = 1.0 / r;
  float a = atan(uv.y, uv.x);
  float ring = mod(floor(z * freq), 2.0);
  float spoke = mod(floor(a * freq * 0.3), 2.0);
  return mix(ring, 1.0 - ring, spoke);
}

float board_warped(vec2 uv, float freq, float time) {
  vec2 w = uv;
  w.x += sin(w.y * 3.0 + time) * 0.2;
  w.y += cos(w.x * 3.0 - time) * 0.2;
  return board_classic(w, freq);
}

void main() {
  // ════════════════════════════════════════════════════════
  // DNA aus Seed ableiten (20+ Parameter)
  // ════════════════════════════════════════════════════════
  float d_style       = hash_seed(u_seed,  1.0);              // 0–1: Stil-Auswahl
  float d_freq        = 2.0 + hash_seed(u_seed,  2.0) * 10.0; // Feldanzahl
  float d_rotation    = (hash_seed(u_seed,  3.0) - 0.5) * 2.0;
  float d_color_speed = 0.1 + hash_seed(u_seed,  4.0) * 1.5;
  float d_bass_react  = 0.4 + hash_seed(u_seed,  5.0) * 0.9;
  float d_mid_react   = 0.4 + hash_seed(u_seed,  6.0) * 0.9;
  float d_high_react  = 0.3 + hash_seed(u_seed,  7.0) * 0.9;
  float d_phase       = hash_seed(u_seed,  8.0) * 6.28318;
  float d_warp_x      = (hash_seed(u_seed,  9.0) - 0.5) * 1.2;
  float d_warp_y      = (hash_seed(u_seed, 10.0) - 0.5) * 1.2;
  float d_pulse_str   = 0.2 + hash_seed(u_seed, 11.0) * 1.0;
  float d_stereo_str  = 0.04 + hash_seed(u_seed, 12.0) * 0.2;
  float d_blink_str   = 0.0 + hash_seed(u_seed, 13.0) * 0.8;
  float d_move_dir_x  = (hash_seed(u_seed, 14.0) - 0.5) * 2.0;
  float d_move_dir_y  = (hash_seed(u_seed, 15.0) - 0.5) * 2.0;
  float d_move_speed  = 0.05 + hash_seed(u_seed, 16.0) * 0.35;
  float d_edge_glow   = 0.0 + hash_seed(u_seed, 17.0) * 0.5;
  float d_detail_amp  = 0.5 + hash_seed(u_seed, 18.0) * 1.5;
  float d_hue_shift   = hash_seed(u_seed, 19.0) * 0.5;
  float d_contrast    = 0.8 + hash_seed(u_seed, 20.0) * 1.2;

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

  // ── Stereo-Verschiebung ─────────────────────────────────
  float lr_diff = u_bass_right - u_bass_left;
  float stereo_shift = lr_diff * d_stereo_str * u_stereo;
  uv.x += stereo_shift;
  uv.y += (u_bass_left + u_bass_right - 1.0) * d_stereo_str * 0.2 * u_stereo;

  vec2 uv0 = uv;

  // ── Frequenz-Reaktion ───────────────────────────────────
  // Bass = Größe, Mid = Rotation, High = Detail
  float size_scale = 1.0 / (1.0 + u_bass * d_bass_react * 0.5);
  float rot_angle  = u_time * d_rotation * 0.1 + u_mid * d_mid_react * 0.4;
  float detail_mul = 1.0 + u_high * d_high_react * 2.0;

  uv = rot2d(uv, rot_angle);
  uv *= size_scale * pulse;

  // Bewegung über das Brett (BPM + Zeit)
  vec2 move = vec2(d_move_dir_x, d_move_dir_y) * u_time * d_move_speed;
  move += vec2(beat_count * 0.1, beat_count * 0.07) * d_move_speed;
  uv += move;

  // Warp
  float mid_warp = u_mid * d_mid_react * 0.15;
  uv.x += sin(uv.y * d_freq * 0.5 + u_time * 0.4) * (d_warp_x + mid_warp) * 0.2;
  uv.y += cos(uv.x * d_freq * 0.5 - u_time * 0.35) * (d_warp_y + mid_warp * 0.7) * 0.2;

  // ── Schachbrett-Stil aus Seed ───────────────────────────
  float board;
  float style = d_style;

  if (style < 0.17) {
    board = board_classic(uv, d_freq * detail_mul);
  } else if (style < 0.33) {
    board = board_smooth(uv, d_freq * detail_mul);
  } else if (style < 0.50) {
    board = board_diagonal(uv, d_freq * detail_mul);
  } else if (style < 0.67) {
    board = board_radial(uv, d_freq * detail_mul);
  } else if (style < 0.83) {
    board = board_tunnel(uv, d_freq * detail_mul);
  } else {
    board = board_warped(uv, d_freq * detail_mul, u_time * d_move_speed);
  }

  // ── BPM-Blinken ─────────────────────────────────────────
  float blink = 1.0 - beat_kick * d_blink_str;
  board = mix(board, 1.0 - board, beat_kick * d_blink_str * 0.5);

  // ── Farbe ───────────────────────────────────────────────
  float hue_a = fract(atan(uv0.y, uv0.x) / 6.28318 * 0.3 * d_color_speed);
  float hue_t = fract(u_time * 0.05 * d_color_speed + d_phase / 6.28318);
  float hue_b = fract(beat_count * 0.08 + u_mid * 0.1);
  float hue   = fract(hue_a + hue_t + hue_b * 0.25 + d_hue_shift);

  vec3 col_a = pal(hue);
  vec3 col_b = pal(fract(hue + 0.5));
  vec3 col   = mix(col_a, col_b, board);

  // High = Detail: feines Rauschen/Highlight auf Kanten
  vec2 g = fract(uv * d_freq * detail_mul) - 0.5;
  float edge = 1.0 - smoothstep(0.0, 0.08, min(abs(g.x), abs(g.y)));
  col += u_pal_highlight * edge * u_high * d_high_react * d_detail_amp * 0.25;

  // Edge Glow aus Seed
  col += u_pal_low * edge * d_edge_glow * 0.3;

  // Kontrast
  col = (col - 0.5) * d_contrast + 0.5;

  // Bass-Puls auf Helligkeit
  col *= 1.0 + u_bass * d_bass_react * 0.25;

  // Zentraler Glow
  float glow = exp(-length(uv0) * (2.0 - u_energy));
  col += u_pal_low * glow * 0.15;
  col += u_pal_high * glow * beat_kick * 0.5;

  // Beat-Flash
  col += beat_kick * 0.04 * u_pal_highlight;

  // Stereo-L/R Akzente
  float s_off = u_stereo * 0.04;
  col += u_pal_low * exp(-length(uv0 + vec2(s_off * u_bass_left,  0.0)) * 5.0) * u_bass_left  * u_stereo * 0.12;
  col += u_pal_low * exp(-length(uv0 - vec2(s_off * u_bass_right, 0.0)) * 5.0) * u_bass_right * u_stereo * 0.12;

  // Vignette
  float vig = 1.0 - dot(uv0 * 1.15, uv0 * 1.15);
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
                * u_fb_decay * 0.35 * (ef.x * ef.y);

  col = feedback + col;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
