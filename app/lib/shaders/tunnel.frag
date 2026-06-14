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

uniform float u_dna_zoom;
uniform float u_dna_rotation;
uniform float u_dna_warp_x;
uniform float u_dna_warp_y;
uniform float u_dna_wave_freq;
uniform float u_dna_color_speed;
uniform float u_dna_spokes;
uniform float u_dna_bass_react;
uniform float u_dna_mid_react;
uniform float u_dna_phase;

uniform vec3 u_pal_shadow;
uniform vec3 u_pal_low;
uniform vec3 u_pal_high;
uniform vec3 u_pal_highlight;

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
  if (t < 0.667) return mix(u_pal_low,     u_pal_high,      (t - 0.333) * 3.0);
                  return mix(u_pal_high,    u_pal_highlight, (t - 0.667) * 3.0);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5);
}

void main() {
  vec2 uv_raw = FlutterFragCoord().xy / vec2(u_width, u_height);
  vec2 uv     = uv_raw * 2.0 - 1.0;
  uv.x      *= u_width / u_height;
  vec2 uv0    = uv;

  float r = length(uv);
  float a = atan(uv.y, uv.x);

  // Tunnel-Tiefe aus Radius: nahe am Zentrum = weit entfernt
  float z = 1.0 / max(r, 0.001);

  // Beat
  float beat_dur   = 60.0 / max(u_bpm, 60.0);
  float beat_phase = fract(u_time / beat_dur);
  float beat_kick  = exp(-beat_phase * 8.0);

  // Bass-Expansion: Ringe rücken nach außen, Tunnel wird dicker
  float bass_expand = u_bass * u_dna_bass_react * 0.30 + beat_kick * 0.10;

  // Bass-Wobble: Tunnelinhalt wackelt mit Bass
  float bass_wobble = u_bass * u_dna_bass_react * sin(u_time * 3.5) * 0.06;

  // Mid-Verzerrung: Warp reagiert auf Mitten (Textur verschiebt sich)
  float mid_warp = u_mid * u_dna_mid_react * 0.15;

  // High-Zittern: Hohe Frequenzen erzeugen feines Rauschen auf der Oberfläche
  float high_shimmer = u_high * 0.25;

  z += bass_expand;
  uv.x += bass_wobble;
  uv.y += bass_wobble * 0.7;

  // Kamera-Shake auf Beat
  float shake = beat_kick * u_energy * 0.04;
  uv.x += (hash(vec2(u_time * 1.3, 0.0)) - 0.5) * shake;
  uv.y += (hash(vec2(0.0, u_time * 1.7)) - 0.5) * shake;

  // Rotation (Tunnel dreht sich, Mid beeinflusst Geschwindigkeit)
  float rot_speed = u_time * u_dna_rotation * 0.15 + u_mid * u_dna_mid_react * 0.25;
  a += rot_speed;

  // --- Tunnel-Oberflächen-UVs ---
  float depth_scale = u_dna_zoom * 0.55;
  float u_t = z * depth_scale - u_time * (0.5 + u_dna_zoom * 0.4);
  float u_s = a / 6.28318;

  // Organische Verzerrung auf Oberfläche (DNA warp + Mid-Reaktion)
  u_t += sin(u_s * u_dna_wave_freq + u_time * 0.4) * (u_dna_warp_x + mid_warp) * 0.22;
  u_s += cos(u_t * u_dna_wave_freq - u_time * 0.35) * (u_dna_warp_y + mid_warp * 0.7) * 0.22;

  // --- Tiefen-basierte Helligkeit (weit weg = dunkler) ---
  float fog = smoothstep(0.0, 8.0, z);
  float brightness = 1.0 - fog * 0.85;

  // --- Muster-Auswahl durch Seed (u_dna_phase bestimmt Stil-Blend) ---
  float pat_t = fract(u_dna_phase / 6.28318);

  // Ringe (konzentrisch im Tunnel)
  float ring_freq = 2.5 + u_dna_wave_freq * 0.5;
  float ring_pos  = fract(u_t * ring_freq) - 0.5;
  // High-Zittern macht Ringe gezackter/lebendiger, Bass macht sie dicker
  float ring_thickness = 0.02 + u_high * high_shimmer + u_bass * u_dna_bass_react * 0.04;
  float ring      = smoothstep(ring_thickness, ring_thickness + 0.20, abs(ring_pos) * (1.0 + u_high * 0.5));
  ring = 1.0 - ring; // Ringe als helle Linien

  // Speichen / Längsrippen (Mid beeinflusst Anzahl/Einteilung)
  float spoke_count = max(2.0, floor(u_dna_spokes + u_mid * u_dna_mid_react * 2.0));
  float spoke_warp = sin(u_s * 6.28318 * spoke_count) * (1.0 + u_mid * 0.4);
  float spoke_thickness = 0.02 + u_mid * 0.06;
  float spoke       = smoothstep(spoke_thickness, spoke_thickness + 0.18, abs(spoke_warp));
  spoke = 1.0 - spoke;

  // Querrippen (Bass macht sie breiter)
  float rib_freq = 1.0 + u_dna_wave_freq * 0.3;
  float rib_raw = sin(u_t * 6.28318 * rib_freq);
  float rib_thickness = 0.03 + u_bass * u_dna_bass_react * 0.06;
  float rib = smoothstep(rib_thickness, rib_thickness + 0.25, abs(rib_raw));
  rib = 1.0 - rib;

  // Blende Muster
  float pattern;
  if (pat_t < 0.33) {
    pattern = mix(ring, mix(ring, spoke, 0.5), pat_t * 3.03);
  } else if (pat_t < 0.67) {
    pattern = mix(spoke, mix(spoke, rib, 0.5), (pat_t - 0.33) * 3.03);
  } else {
    pattern = mix(rib, ring, (pat_t - 0.67) * 3.03);
  }

  pattern = clamp(pattern * brightness, 0.0, 1.0);

  // --- Farbe ---
  float hue_z = fract(u_t * 0.12 * u_dna_color_speed);
  float hue_a = fract(u_s * 0.5 * u_dna_color_speed);
  float hue   = fract(hue_z + hue_a * 0.25 + u_dna_phase / 6.28318);
  vec3 col    = pal(hue) * pattern;

  // Zentraler Glow (sanfter, dunkler)
  float glow = exp(-r * (1.6 - u_energy * 0.8));
  col += u_pal_low * glow * 0.15;
  col += u_pal_high * glow * beat_kick * 0.6;

  // Beat-Flash
  col += beat_kick * 0.04 * u_pal_highlight;

  // Stereo-Akkorde
  float s_off = u_stereo * 0.03;
  col += u_pal_low * exp(-length(uv + vec2(s_off * u_bass_left,  0.0)) * 5.0) * u_bass_left  * u_stereo * 0.12;
  col += u_pal_low * exp(-length(uv - vec2(s_off * u_bass_right, 0.0)) * 5.0) * u_bass_right * u_stereo * 0.12;

  // Vignette
  float vig = 1.0 - dot(uv0 * 1.2, uv0 * 1.2);
  col *= clamp(vig, 0.0, 1.0);

  // Feedback (subtraktiv gedimmt damit nicht zu hell)
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
                * u_fb_decay * 0.4 * (ef.x * ef.y);

  col = feedback + col;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
