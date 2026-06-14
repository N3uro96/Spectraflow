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

// ── Muster-Funktionen ─────────────────────────────────────
float pat_circles(vec2 uv, float freq) {
  float r = length(uv);
  float c = sin(r * freq * 6.28318);
  return 1.0 - smoothstep(0.0, 0.15, abs(c));
}

float pat_lines(vec2 uv, float freq) {
  float l = sin(uv.x * freq * 6.28318) * sin(uv.y * freq * 6.28318);
  return 1.0 - smoothstep(0.0, 0.2, abs(l));
}

float pat_grid(vec2 uv, float freq) {
  vec2 g = fract(uv * freq) - 0.5;
  float m = max(abs(g.x), abs(g.y));
  return 1.0 - smoothstep(0.02, 0.12, m);
}

float pat_spiral(vec2 uv, float arms, float freq) {
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  float s = sin(arms * a + r * freq);
  return 1.0 - smoothstep(0.0, 0.25, abs(s));
}

float pat_weave(vec2 uv, float freq) {
  float w = sin((uv.x + uv.y) * freq * 3.14159)
          * cos((uv.x - uv.y) * freq * 3.14159);
  return 1.0 - smoothstep(0.0, 0.18, abs(w));
}

float pat_noise(vec2 uv, float freq) {
  vec2 q = uv * freq;
  float n = sin(q.x + sin(q.y + u_time * 0.2) * 1.5)
          + cos(q.y * 1.3 + sin(q.x * 1.7 - u_time * 0.15) * 1.2);
  return 1.0 - smoothstep(0.2, 1.0, abs(n) * 0.5);
}

// Kaleidoskop-Faltung
vec2 kaleido_fold(vec2 uv, float segments, float offset) {
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  float seg = 6.28318 / max(segments, 2.0);
  a += offset;
  float a_fold = mod(a + seg * 0.5, seg) - seg * 0.5;
  a_fold = abs(a_fold);
  return vec2(cos(a_fold), sin(a_fold)) * r;
}

void main() {
  // ════════════════════════════════════════════════════════
  // DNA aus Seed ableiten (20+ Parameter)
  // ════════════════════════════════════════════════════════
  float d_segments    = floor(3.0 + hash_seed(u_seed,  1.0) * 13.0);   // 3–16 Spiegelsegmente
  float d_rotation    = (0.3 + hash_seed(u_seed,  2.0) * 1.7)
                      * (hash_seed(u_seed,  3.0) > 0.5 ? 1.0 : -1.0);
  float d_zoom        = 0.6 + hash_seed(u_seed,  4.0) * 1.2;
  float d_warp_x      = (hash_seed(u_seed,  5.0) - 0.5) * 1.6;
  float d_warp_y      = (hash_seed(u_seed,  6.0) - 0.5) * 1.6;
  float d_wave_freq   = 1.0 + hash_seed(u_seed,  7.0) * 7.0;
  float d_color_speed = 0.15 + hash_seed(u_seed,  8.0) * 2.5;
  float d_bass_react  = 0.4 + hash_seed(u_seed,  9.0) * 1.0;
  float d_mid_react   = 0.4 + hash_seed(u_seed, 10.0) * 1.0;
  float d_high_react  = 0.3 + hash_seed(u_seed, 11.0) * 0.9;
  float d_phase       = hash_seed(u_seed, 12.0) * 6.28318;
  float d_shape_type  = hash_seed(u_seed, 13.0);                       // 0–0.99
  float d_shape_mix   = hash_seed(u_seed, 14.0);                       // 0 = Form A, 1 = Form B
  float d_mirror_type = hash_seed(u_seed, 15.0);                       // 0/1/2
  float d_swirl       = (hash_seed(u_seed, 16.0) - 0.5) * 4.0;
  float d_layers      = floor(2.0 + hash_seed(u_seed, 17.0) * 4.0);    // 2–5 Layer
  float d_pulse_str   = 0.2 + hash_seed(u_seed, 18.0) * 1.0;
  float d_stereo_str  = 0.1 + hash_seed(u_seed, 19.0) * 0.8;
  float d_detail_amp  = 0.5 + hash_seed(u_seed, 20.0) * 1.5;

  // ── UV Setup ────────────────────────────────────────────
  vec2 uv_raw = FlutterFragCoord().xy / vec2(u_width, u_height);
  vec2 uv = uv_raw * 2.0 - 1.0;
  uv.x *= u_width / u_height;

  // ── Beat / BPM ──────────────────────────────────────────
  float beat_dur   = 60.0 / max(u_bpm, 60.0);
  float beat_phase = fract(u_time / beat_dur);
  float beat_kick  = exp(-beat_phase * 8.0);
  float pulse      = 1.0 + beat_kick * d_pulse_str;

  // ── Stereo-Drehung ──────────────────────────────────────
  float lr_diff = u_bass_right - u_bass_left;
  float stereo_rot = lr_diff * d_stereo_str * u_stereo;

  // ── Frequenz-gesteuerte Parameter ───────────────────────
  // Bass = Größe, Mid = Rotation, High = Detail
  float size_scale = d_zoom * (1.0 + u_bass * d_bass_react * 0.5) * pulse;
  float rot_speed  = u_time * d_rotation * 0.15
                   + u_mid * d_mid_react * 0.6
                   + stereo_rot;
  float detail_mul = 1.0 + u_high * d_high_react * 3.0;

  uv /= size_scale;
  uv = rot2d(uv, rot_speed);

  // ── Kamera-Shake ────────────────────────────────────────
  float shake = beat_kick * u_energy * 0.03;
  uv.x += (hash(vec2(u_time * 1.1, 0.0)) - 0.5) * shake;
  uv.y += (hash(vec2(0.0, u_time * 1.3)) - 0.5) * shake;

  // ── Kaleidoskop-Faltung ─────────────────────────────────
  float fold_offset = d_phase * 0.1 + u_time * d_rotation * 0.05;
  vec2 kuv = kaleido_fold(uv, d_segments, fold_offset);

  // Zusätzliche Spiegelung für manche Seeds
  if (d_mirror_type > 0.66) {
    kuv = abs(kuv);
    kuv = kaleido_fold(kuv, d_segments * 0.5, -fold_offset * 0.5);
  } else if (d_mirror_type > 0.33) {
    kuv.x = abs(kuv.x);
  }

  // ── Warp / Swirl ────────────────────────────────────────
  float r = length(kuv);
  float a = atan(kuv.y, kuv.x);
  a += r * d_swirl * 0.2 + u_mid * d_mid_react * 0.3;
  kuv = vec2(cos(a), sin(a)) * r;

  kuv.x += sin(kuv.y * d_wave_freq + u_time * 0.5) * d_warp_x * 0.2;
  kuv.y += cos(kuv.x * d_wave_freq - u_time * 0.4) * d_warp_y * 0.2;

  // ── Muster-Layer ────────────────────────────────────────
  float pattern = 0.0;
  float layer_intensity = 1.0;

  for (int i = 0; i < 5; i++) {
    if (float(i) >= d_layers) break;

    float fi = float(i);
    float scale = 1.0 + fi * 0.7;
    vec2 luv = kuv * scale + fi * 1.7;

    float freq = d_wave_freq * detail_mul * scale;
    float shape_a, shape_b;

    // Primäre Form
    if (d_shape_type < 0.20) {
      shape_a = pat_circles(luv, freq);
      shape_b = pat_spiral(luv, d_segments, freq);
    } else if (d_shape_type < 0.40) {
      shape_a = pat_grid(luv, freq);
      shape_b = pat_weave(luv, freq);
    } else if (d_shape_type < 0.60) {
      shape_a = pat_spiral(luv, d_segments * 0.5, freq);
      shape_b = pat_circles(luv, freq * 0.5);
    } else if (d_shape_type < 0.80) {
      shape_a = pat_lines(luv, freq);
      shape_b = pat_noise(luv, freq * 0.6);
    } else {
      shape_a = pat_noise(luv, freq * 0.5);
      shape_b = pat_weave(luv, freq);
    }

    float layer = mix(shape_a, shape_b, d_shape_mix);
    layer *= layer_intensity / (1.0 + fi * 0.4);

    // High erzeugt feine Details pro Layer
    layer += pat_noise(luv, freq * 2.0) * u_high * d_high_react * d_detail_amp * 0.3;

    pattern += layer;
    layer_intensity *= 0.7;
  }

  pattern = clamp(pattern, 0.0, 1.0);

  // ── Farbe ───────────────────────────────────────────────
  float hue_a = fract(atan(uv.y, uv.x) / 6.28318 * 0.5 * d_color_speed);
  float hue_t = fract(u_time * 0.06 * d_color_speed + d_phase / 6.28318);
  float hue_b = fract(beat_phase * 0.2 + u_mid * 0.1); // BPM-Farbimpuls
  float hue   = fract(hue_a + hue_t * 0.4 + hue_b * 0.2);

  vec3 col = pal(hue) * pattern;

  // High = Detail: Highlights auf Kanten
  col += u_pal_highlight * u_high * d_high_react * 0.15 * pattern;

  // Bass-Puls als Helligkeitsschub
  col *= 1.0 + u_bass * d_bass_react * 0.35;

  // Zentraler Glow
  float glow = exp(-length(uv) * (2.0 - u_energy));
  col += u_pal_low * glow * 0.2;
  col += u_pal_high * glow * beat_kick * 0.7;

  // Beat-Flash
  col += beat_kick * 0.05 * u_pal_highlight;

  // Stereo-L/R Leuchtbögen
  float s_off = u_stereo * 0.05;
  col += u_pal_low  * exp(-length(uv + vec2(s_off * u_bass_left,  0.0)) * 5.0) * u_bass_left  * u_stereo * 0.15;
  col += u_pal_low  * exp(-length(uv - vec2(s_off * u_bass_right, 0.0)) * 5.0) * u_bass_right * u_stereo * 0.15;

  // Vignette
  vec2 uv0 = uv_raw * 2.0 - 1.0;
  uv0.x *= u_width / u_height;
  float vig = 1.0 - dot(uv0 * 1.2, uv0 * 1.2);
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
