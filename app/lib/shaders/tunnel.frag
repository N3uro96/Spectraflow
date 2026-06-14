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

// 2D-Rotation
vec2 rot2d(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// ── Geometrische Formen im Tunnel ─────────────────────────
float shape_hex(vec2 uv, float n) {
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  float seg = 6.28318 / n;
  float a_fold = mod(a + seg * 0.5, seg) - seg * 0.5;
  float hex = cos(a_fold) * r;
  return 1.0 - smoothstep(0.02, 0.10, abs(fract(hex * 2.0) - 0.5));
}

float shape_tri(vec2 uv, float n) {
  float a = atan(uv.y, uv.x);
  float tri = abs(sin(a * n));
  return 1.0 - smoothstep(0.02, 0.18, abs(1.0 - tri));
}

float shape_grid(vec2 uv, float freq) {
  vec2 g = fract(uv * freq) - 0.5;
  return 1.0 - smoothstep(0.02, 0.12, max(abs(g.x), abs(g.y)));
}

// ── Organische Spiralarme ─────────────────────────────────
float shape_spiral(vec2 uv, float arms, float freq) {
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  float spiral = sin(arms * a + r * freq + u_time * 0.5);
  return 1.0 - smoothstep(0.10, 0.35, abs(spiral));
}

float shape_noise(vec2 uv, float freq) {
  vec2 q = uv * freq;
  float n = sin(q.x + sin(q.y + u_time * 0.3) * 1.7)
          + cos(q.y * 1.3 + sin(q.x * 1.7 - u_time * 0.2) * 1.3);
  return 1.0 - smoothstep(0.0, 1.2, abs(n) * 0.5);
}

void main() {
  // ════════════════════════════════════════════════════════
  // DNA aus Seed ableiten (20 Parameter)
  // ════════════════════════════════════════════════════════
  float d_zoom        = 0.7 + hash_seed(u_seed,  1.0) * 0.7;
  float d_rotation    = (0.4 + hash_seed(u_seed,  2.0) * 1.6)
                      * (hash_seed(u_seed,  3.0) > 0.5 ? 1.0 : -1.0);
  float d_warp_x      = (hash_seed(u_seed,  4.0) - 0.5) * 1.4;
  float d_warp_y      = (hash_seed(u_seed,  5.0) - 0.5) * 1.4;
  float d_wave_freq   = 1.0 + hash_seed(u_seed,  6.0) * 8.0;
  float d_color_speed = 0.2 + hash_seed(u_seed,  7.0) * 2.8;
  float d_spokes      = floor(2.0 + hash_seed(u_seed,  8.0) * 10.0);
  float d_bass_react  = 0.4 + hash_seed(u_seed,  9.0) * 0.9;
  float d_mid_react   = 0.4 + hash_seed(u_seed, 10.0) * 0.9;
  float d_phase       = hash_seed(u_seed, 11.0) * 6.28318;
  float d_shape_mix   = hash_seed(u_seed, 12.0);              // 0 = geo, 1 = organisch
  float d_spiral_arms = floor(2.0 + hash_seed(u_seed, 13.0) * 10.0);
  float d_twist       = (hash_seed(u_seed, 14.0) - 0.5) * 3.5; // Vortex-Twist
  float d_geo_type    = hash_seed(u_seed, 15.0);              // 0=tri, 0.33=hex, 0.66=grid
  float d_backward    = hash_seed(u_seed, 16.0) < 0.05 ? -1.0 : 1.0;
  float d_fog_dense   = 0.3 + hash_seed(u_seed, 17.0) * 0.8;
  float d_pulse_str   = 0.3 + hash_seed(u_seed, 18.0) * 1.2;
  float d_stereo_str  = 0.04 + hash_seed(u_seed, 19.0) * 0.22;
  float d_sog_power   = 0.5 + hash_seed(u_seed, 20.0) * 1.5;  // Sog-Stärke

  // UV
  vec2 uv_raw = FlutterFragCoord().xy / vec2(u_width, u_height);
  vec2 uv     = uv_raw * 2.0 - 1.0;
  uv.x       *= u_width / u_height;

  // ── Stereo: Fluchtpunkt verschiebt sich ─────────────────
  float lr_diff = u_bass_right - u_bass_left;
  float stereo_shift_x = lr_diff * d_stereo_str * u_stereo;
  float stereo_shift_y = (u_bass_left + u_bass_right - 1.0) * d_stereo_str * 0.3 * u_stereo;
  uv -= vec2(stereo_shift_x, stereo_shift_y);

  vec2 uv0 = uv;

  float r = length(uv);
  float a = atan(uv.y, uv.x);

  // ── Beat / BPM ──────────────────────────────────────────
  float beat_dur   = 60.0 / max(u_bpm, 60.0);
  float beat_count = floor(u_time / beat_dur);
  float beat_phase = fract(u_time / beat_dur);
  float beat_kick  = exp(-beat_phase * 8.0);

  // Takt-Snap: Bewegung wird quantisiert + weicher Übergang im Beat
  float snap_time = beat_count * beat_dur + pow(beat_phase, 1.6) * beat_dur;

  // ── Bass-Expansion + Sog ────────────────────────────────
  float bass_expand = u_bass * d_bass_react * 0.35 + beat_kick * 0.12;
  float z = 1.0 / max(r, 0.001);
  z += bass_expand;

  // Sog: Geschwindigkeit nimmt mit Tiefe zu
  float sog = pow(z / 8.0, d_sog_power);

  // Rückwärts-Modus: selten (5%) — Ringe fliegen auf Betrachter zu
  float travel_dir = d_backward;

  // Rotation mit Vortex-Twist (Tiefe verdreht Winkel)
  a += u_time * d_rotation * 0.12
     + u_mid * d_mid_react * 0.22
     + z * d_twist * 0.15;

  // Kamera-Shake
  float shake = beat_kick * u_energy * 0.035;
  uv.x += (hash(vec2(u_time * 1.3, 0.0)) - 0.5) * shake;
  uv.y += (hash(vec2(0.0, u_time * 1.7)) - 0.5) * shake;

  // ── Tunnel-Oberflächen-UVs ──────────────────────────────
  float depth_scale = d_zoom * 0.55;
  float base_speed  = 0.4 + d_zoom * 0.5;
  float u_t = z * depth_scale
            - snap_time * base_speed * travel_dir
            - sog * 0.4 * travel_dir;
  float u_s = a / 6.28318;

  // Warp auf Oberfläche
  float mid_warp = u_mid * d_mid_react * 0.2;
  u_t += sin(u_s * d_wave_freq + u_time * 0.4) * (d_warp_x + mid_warp) * 0.22;
  u_s += cos(u_t * d_wave_freq - u_time * 0.35) * (d_warp_y + mid_warp * 0.7) * 0.22;

  // ── Tiefen-Fog ──────────────────────────────────────────
  float fog = smoothstep(0.0, 8.0, z) * d_fog_dense;
  float depth_brightness = 1.0 - fog;

  // ── Muster-Layer ────────────────────────────────────────
  vec2 tuv = vec2(u_t, u_s * 6.28318);

  // Geometrischer Layer
  float geo_shape;
  if (d_geo_type < 0.33) {
    geo_shape = shape_tri(tuv, d_spokes);
  } else if (d_geo_type < 0.66) {
    geo_shape = shape_hex(tuv, d_spokes);
  } else {
    geo_shape = shape_grid(tuv, d_wave_freq);
  }

  // Organischer Layer
  float org_spiral = shape_spiral(tuv, d_spiral_arms, d_wave_freq);
  float org_noise  = shape_noise(tuv, d_wave_freq * 0.7);
  float organic    = mix(org_spiral, org_noise, 0.4);

  // Ringe (immer als Tiefendisziplin)
  float ring_freq = 2.5 + d_wave_freq * 0.5;
  float ring_pos  = fract(u_t * ring_freq) - 0.5;
  float ring_thick = 0.015 + u_high * 0.15 + u_bass * d_bass_react * 0.04;
  float rings = 1.0 - smoothstep(ring_thick, ring_thick + 0.22, abs(ring_pos) * (1.0 + u_high * 0.6));

  // Kombination: Seed bestimmt Geo/Organik-Anteil, Ringe sind immer dabei
  float pattern = mix(geo_shape, organic, d_shape_mix);
  pattern = max(pattern, rings * 0.6);

  // Beat-Pulse auf Pattern
  pattern *= 1.0 + beat_kick * d_pulse_str;
  pattern = clamp(pattern * depth_brightness, 0.0, 1.0);

  // ── Farbe ───────────────────────────────────────────────
  float hue_z = fract(u_t * 0.12 * d_color_speed);
  float hue_a = fract(u_s * 0.6 * d_color_speed);
  float hue_b = fract(beat_count * 0.1 + d_phase / 6.28318); // BPM-getriebene Farbwechsel
  float hue   = fract(hue_z + hue_a * 0.3 + hue_b * 0.15);
  vec3 col    = pal(hue) * pattern;

  // High-Zittern auf Farbe
  col += u_pal_highlight * u_high * 0.12 * pattern;

  // Zentraler Glow
  float glow = exp(-r * (1.8 - u_energy));
  col += u_pal_low * glow * 0.2;
  col += u_pal_high * glow * beat_kick * 0.8;

  // Beat Flash
  col += beat_kick * 0.06 * u_pal_highlight;

  // Stereo-L/R Leuchtbögen
  float s_off = u_stereo * 0.04;
  col += u_pal_low  * exp(-length(uv + vec2(s_off * u_bass_left,  0.0)) * 5.0) * u_bass_left  * u_stereo * 0.18;
  col += u_pal_low  * exp(-length(uv - vec2(s_off * u_bass_right, 0.0)) * 5.0) * u_bass_right * u_stereo * 0.18;
  col += u_pal_high * exp(-length(uv + vec2(s_off * 2.0, 0.0)) * 4.0) * u_mid * u_stereo * 0.1;

  // Vignette
  float vig = 1.0 - dot(uv0 * 1.25, uv0 * 1.25);
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
