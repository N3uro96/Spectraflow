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
uniform float u_seed;        // 11

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

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5);
}

// ── Zell-Typen ────────────────────────────────────────────
// Jede Funktion gibt zurück: x = Checker-Wert (0/1), y = Kanten-Nähe (0=Kante, 1=Mitte)

vec2 cell_square(vec2 p) {
  vec2 f = fract(p) - 0.5;
  float check = mod(floor(p.x) + floor(p.y), 2.0);
  float edge  = min(abs(f.x), abs(f.y)) * 2.0;
  return vec2(check, edge);
}

vec2 cell_hex(vec2 p) {
  // Hex-Gitter via Scherung
  p.x += p.y * 0.5774;
  vec2 h    = floor(p);
  float check = mod(h.x + h.y, 2.0);
  vec2 f    = fract(p) - 0.5;
  float edge = min(abs(f.x), abs(f.y)) * 2.0;
  return vec2(check, edge);
}

vec2 cell_triangle(vec2 p) {
  vec2 f = fract(p);
  float check = mod(floor(p.x) + floor(p.y) + step(f.x + f.y, 1.0), 2.0);
  // Kanten-Nähe: Abstand zur nächsten Seite
  float e1 = min(f.x, 1.0 - f.x);
  float e2 = min(f.y, 1.0 - f.y);
  float e3 = min(abs(f.x + f.y - 1.0) * 0.707, 0.5);
  float edge = min(e1, min(e2, e3)) * 2.0;
  return vec2(check, edge);
}

vec2 cell_diamond(vec2 p) {
  vec2 rot = vec2(p.x + p.y, p.x - p.y) * 0.7071;
  vec2 f   = fract(rot) - 0.5;
  float check = mod(floor(rot.x) + floor(rot.y), 2.0);
  float edge  = min(abs(f.x), abs(f.y)) * 2.0;
  return vec2(check, edge);
}

vec2 cell_radial(vec2 p, float sectors) {
  float r = length(p);
  float a = atan(p.y, p.x) / 6.28318 * sectors;
  float check = mod(floor(r) + floor(a), 2.0);
  float er = abs(fract(r) - 0.5) * 2.0;
  float ea = abs(fract(a) - 0.5) * 2.0;
  float edge  = min(er, ea);
  return vec2(check, edge);
}

void main() {
  // ════════════════════════════════════════════════════════
  // DNA aus Seed — 20 Parameter
  // ════════════════════════════════════════════════════════
  float d_cell_type   = hash_seed(u_seed,  1.0);              // 0=sq 0.25=hex 0.5=tri 0.75=radial 1=diamond
  float d_projection  = hash_seed(u_seed,  2.0);              // 0=flat 0.4=persp 0.7=zoom
  float d_freq        = 3.0 + hash_seed(u_seed,  3.0) * 11.0; // 3–14 Zellen
  float d_rotation    = (hash_seed(u_seed,  4.0) * 2.0 - 1.0) * 0.7;
  float d_move_x      = (hash_seed(u_seed,  5.0) * 2.0 - 1.0);
  float d_move_y      = (hash_seed(u_seed,  6.0) * 2.0 - 1.0);
  float d_speed       = 0.08 + hash_seed(u_seed,  7.0) * 0.7; // Scroll-Geschwindigkeit
  float d_bass_freq   = hash_seed(u_seed,  8.0);              // Bass → Zell-Größe
  float d_bass_zoom   = hash_seed(u_seed,  9.0);              // Bass → Zoom
  float d_bass_warp   = hash_seed(u_seed, 10.0);              // Bass → Warp
  float d_warp_str    = hash_seed(u_seed, 11.0) * 0.9;
  float d_warp_freq   = 1.0 + hash_seed(u_seed, 12.0) * 5.0;
  float d_color_style = hash_seed(u_seed, 13.0);              // 0=klassisch 0.5=neon 1=rainbow
  float d_color_speed = 0.05 + hash_seed(u_seed, 14.0) * 1.4;
  float d_phase       = hash_seed(u_seed, 15.0) * 6.28318;
  float d_mid_react   = 0.2 + hash_seed(u_seed, 16.0) * 0.9;
  float d_high_react  = 0.2 + hash_seed(u_seed, 17.0) * 0.9;
  float d_pulse_str   = 0.3 + hash_seed(u_seed, 18.0) * 1.3;
  float d_stereo_str  = 0.03 + hash_seed(u_seed, 19.0) * 0.18;
  float d_persp_str   = 0.3  + hash_seed(u_seed, 20.0) * 0.9; // Tiefe des 3D-Bodens

  // ── UV Setup ────────────────────────────────────────────
  vec2 uv_raw = FlutterFragCoord().xy / vec2(u_width, u_height);
  vec2 uv     = uv_raw * 2.0 - 1.0;
  uv.x       *= u_width / u_height;

  // ── Beat / BPM ──────────────────────────────────────────
  float beat_dur   = 60.0 / max(u_bpm, 60.0);
  float beat_count = floor(u_time / beat_dur);
  float beat_phase = fract(u_time / beat_dur);
  float beat_kick  = exp(-beat_phase * 8.0);

  // ── Stereo: verschiebt den Beobachtungspunkt ─────────────
  float lr_diff = u_bass_right - u_bass_left;
  uv.x -= lr_diff * d_stereo_str * u_stereo;

  // ── Rotation + Mid-Boost ─────────────────────────────────
  float rot = u_time * d_rotation * 0.1 + u_mid * d_mid_react * 0.3;
  float c = cos(rot), s = sin(rot);
  uv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);

  // ── Bass-Reaktion (3 unabhängige Achsen per Seed) ─────────
  float bass_zoom_fac = 1.0 + u_bass * d_bass_zoom * 0.5 + beat_kick * d_pulse_str * 0.35;
  uv /= bass_zoom_fac;

  // ── Projektion ───────────────────────────────────────────
  vec2 grid_uv;
  bool is_sky = false;

  if (d_projection < 0.4) {
    // — FLACH: Standard 2D —
    grid_uv = uv;

  } else if (d_projection < 0.7) {
    // — PERSPEKTIV-BODEN (klassischer Demoscene-Look) —
    float horizon = 0.05 + u_mid * d_mid_react * 0.08;
    float py = uv.y - horizon;
    if (py >= 0.0) {
      is_sky = true;
      grid_uv = uv;
    } else {
      float depth = d_persp_str / max(-py, 0.001);
      float fz    = depth + u_time * d_speed * 2.0
                  + u_bass * d_bass_freq * 0.8;
      float fx    = uv.x * depth
                  + vec2(d_move_x, d_move_y).x * u_time * d_speed * 0.3;
      grid_uv = vec2(fx, fz);
    }

  } else {
    // — ZOOM-TUNNEL (Raster auf den Betrachter zu) —
    float r_uv  = length(uv);
    float a_uv  = atan(uv.y, uv.x);
    float depth = 1.0 / max(r_uv, 0.001);
    float fz    = depth * d_persp_str * 0.4
                + u_time * d_speed * 1.5
                + u_bass * d_bass_freq * 0.6;
    grid_uv = vec2(a_uv / 6.28318 * d_freq, fz);
  }

  // ── Scroll (für flache + Perspektiv-Projektion) ──────────
  if (!is_sky && d_projection < 0.7) {
    vec2 dir = normalize(vec2(d_move_x, d_move_y) + vec2(0.001));
    grid_uv += dir * u_time * d_speed
             + dir * u_bass * d_bass_freq * 0.3;
  }

  // ── Warp: Raster verbiegt sich zur Musik ─────────────────
  float mid_warp = u_mid * d_mid_react * 0.15;
  grid_uv.x += sin(grid_uv.y * d_warp_freq + u_time * 0.5 + d_phase)
             * (d_warp_str + mid_warp);
  grid_uv.y += cos(grid_uv.x * d_warp_freq - u_time * 0.4)
             * (d_warp_str * 0.8 + mid_warp * 0.6);

  // ── Frequenz mit Bass-Modulation ─────────────────────────
  float freq = d_freq * (1.0 + u_bass * d_bass_freq * 0.35);

  // ── Zell-Typ wählen & Checker+Kante berechnen ────────────
  vec2 cell;
  if (d_cell_type < 0.22) {
    cell = cell_square(grid_uv * freq);
  } else if (d_cell_type < 0.44) {
    cell = cell_hex(grid_uv * freq);
  } else if (d_cell_type < 0.66) {
    cell = cell_triangle(grid_uv * freq);
  } else if (d_cell_type < 0.85) {
    cell = cell_radial(grid_uv, d_freq * 0.8);
  } else {
    cell = cell_diamond(grid_uv * freq);
  }

  float checker = cell.x;
  float edge    = clamp(cell.y, 0.0, 1.0);

  // ── Beat-Puls: Raster weitet sich aus ────────────────────
  // Durch beat_kick kurz d_freq erhöhen → Gitter schwingt
  float pulse_edge = clamp(edge + beat_kick * d_pulse_str * 0.5, 0.0, 1.0);

  // ── Kanten-Glow (High-Frequenz beleuchtet Ränder) ────────
  float edge_glow = clamp(0.04 / (1.0 - edge + 0.02), 0.0, 1.0)
                  * u_high * d_high_react;

  // ════════════════════════════════════════════════════════
  // FARB-STIL — Seed mischt drei Stile
  // ════════════════════════════════════════════════════════

  // — KLASSISCH: Zwei-Ton Palette, saubere Felder —
  float hue_classic = fract(u_time * 0.04 * d_color_speed + d_phase / 6.28318
                          + beat_count * 0.07);
  vec3 col_a = pal(hue_classic);
  vec3 col_b = pal(fract(hue_classic + 0.5));
  vec3 classic_col = mix(col_a * 0.15, col_b, checker)
                   * (0.6 + pulse_edge * 0.5);

  // — NEON: Dunkler Hintergrund + leuchtende Kanten —
  vec3 neon_base = mix(u_pal_shadow * 0.1, u_pal_shadow * 0.2, checker);
  vec3 neon_edge = pal(fract(hue_classic + checker * 0.5))
                 * (1.0 - smoothstep(0.0, 0.25, edge)) * 2.5;
  vec3 neon_col  = neon_base + neon_edge;
  neon_col      += edge_glow * u_pal_highlight * 1.5;

  // — RAINBOW: Jede Zelle hat ihren eigenen Farbton —
  // Zell-ID aus floor(grid_uv * freq)
  vec2  cell_id    = floor(grid_uv * freq);
  float cell_hash  = hash(cell_id + d_phase);
  float hue_cell   = fract(cell_hash + u_time * 0.05 * d_color_speed + beat_count * 0.06);
  vec3  rainbow_col= pal(hue_cell) * (0.3 + pulse_edge * 0.8);
  rainbow_col     += edge_glow * u_pal_highlight;

  // Blend: d_color_style  0→Klassisch  0.5→Neon  1→Rainbow
  vec3 col;
  if (d_color_style < 0.5) {
    col = mix(classic_col, neon_col, d_color_style * 2.0);
  } else {
    col = mix(neon_col, rainbow_col, (d_color_style - 0.5) * 2.0);
  }

  // ── Himmel bei Perspektiv-Projektion ────────────────────
  if (is_sky) {
    vec3 sky = u_pal_shadow * 0.4 + u_pal_low * 0.3;
    float horizon_glow = exp(-abs(uv.y) * 4.0) * u_energy;
    sky += pal(hue_classic) * horizon_glow * 0.6;
    col  = sky;
  }

  // ── Stereo-L/R Leuchtbögen ──────────────────────────────
  vec2 uv_s = uv_raw * 2.0 - 1.0;
  uv_s.x   *= u_width / u_height;
  float s_off = u_stereo * 0.04;
  col += u_pal_low * exp(-length(uv_s + vec2( s_off * u_bass_left,  0.0)) * 5.0) * u_bass_left  * u_stereo * 0.18;
  col += u_pal_low * exp(-length(uv_s - vec2( s_off * u_bass_right, 0.0)) * 5.0) * u_bass_right * u_stereo * 0.18;

  // ── Beat-Flash ──────────────────────────────────────────
  col += beat_kick * 0.05 * u_pal_highlight;

  // ── Energie-Boost ───────────────────────────────────────
  col *= 0.85 + u_energy * 0.35;

  // ── Vignette (screen-space, kein AR) ────────────────────
  vec2  vig_uv = uv_raw * 2.0 - 1.0;
  float vig    = 1.0 - smoothstep(0.5, 1.5, dot(vig_uv, vig_uv));
  col         *= vig;

  // ── Milkdrop Feedback ────────────────────────────────────
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
                * u_fb_decay * 0.35 * (ef.x * ef.y);

  col = feedback + col;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
