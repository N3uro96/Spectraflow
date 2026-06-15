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

const float PI  = 3.14159265359;
const float TAU = 6.28318530718;

// ── HILFSFUNKTIONEN ────────────────────────────────────────
float dna(float salt) {
    return fract(sin(salt * 92.7463 + u_seed * 13.37) * 43758.5453);
}

vec3 get_palette(float t) {
    t = fract(t);
    vec3 col = mix(u_pal_shadow, u_pal_low, smoothstep(0.0, 0.33, t));
    col = mix(col, u_pal_high, smoothstep(0.33, 0.66, t));
    col = mix(col, u_pal_highlight, smoothstep(0.66, 1.0, t));
    return col;
}

mat2 rot2(float a) { 
    float c = cos(a), s = sin(a); 
    return mat2(c, -s, s, c); 
}

// ── 8 MATHEMATISCHE GRUNDSTRUKTUREN (Branchless-Ansatz) ────
float get_base_pattern(vec2 p, float style_id, float r, float a) {
    // Style 0: Organische Wellenringe
    float s0 = sin(r * 15.0 - u_time * 2.0) * cos(a * 4.0);
    // Style 1: Scharfe Zahnräder
    float s1 = smoothstep(0.4, 0.5, r + sin(a * 10.0) * 0.1);
    // Style 2: Geometrisches Gitter
    float s2 = sin(p.x * 20.0) * cos(p.y * 20.0);
    // Style 3: Strahlende Sterne
    float s3 = exp(-r * 3.0) * (1.0 + cos(a * 8.0) * 0.5);
    // Style 4: Hypnotische Spirale
    float s4 = sin(r * 25.0 - a * 3.0 - u_time * 3.0);
    // Style 5: Fraktale Zellen (Voronoi-Style)
    float s5 = abs(sin(r * 10.0) * sin(a * 5.0)) + abs(cos(r * 15.0));
    // Style 6: Zickzack-Labyrinth
    float s6 = abs(fract(r * 5.0 + a * 2.0) - 0.5) * 2.0;
    // Style 7: Audio-Pulsar (stark frequenzabhängig)
    float s7 = sin(r * (10.0 + u_mid * 20.0)) * cos(a * (2.0 + u_high * 10.0));

    // Mischpult für die Styles
    float c = 0.0;
    c += s0 * step(0.0, style_id) * step(style_id, 0.5);
    c += s1 * step(0.5, style_id) * step(style_id, 1.5);
    c += s2 * step(1.5, style_id) * step(style_id, 2.5);
    c += s3 * step(2.5, style_id) * step(style_id, 3.5);
    c += s4 * step(3.5, style_id) * step(style_id, 4.5);
    c += s5 * step(4.5, style_id) * step(style_id, 5.5);
    c += s6 * step(5.5, style_id) * step(style_id, 6.5);
    c += s7 * step(6.5, style_id);
    
    return c;
}

void main() {
    vec2 fc = FlutterFragCoord().xy;
    vec2 res = vec2(u_width, u_height);
    vec2 uv_raw = fc / res;
    
    // Aspektkorrigierte, zentrierte UVs
    vec2 uv = (fc - res * 0.5) / min(u_width, u_height);

    // ── 1. GENETISCHER CODE (64 Shapes Matrix) ─────────────
    // Generiert eine ID von 0 bis 63
    float d_shape_id = floor(dna(1.0) * 64.0);
    
    // Teilt die ID in Symmetrie (3 bis 10 Achsen) und Style (0 bis 7)
    float d_symmetry = mod(d_shape_id, 8.0) + 3.0; 
    float d_style    = floor(d_shape_id / 8.0);
    
    float d_rotation_speed = (dna(2.0) - 0.5) * 2.0;
    float d_color_shift    = dna(3.0) * 2.0;

    // ── 2. AUDIO & BEAT REAKTIVITÄT ────────────────────────
    // Takt-Erkennung
    float beat_phase = fract(u_time * (max(u_bpm, 60.0) / 60.0));
    // Scharfer Impuls beim Beat-Start, verstärkt durch Bass
    float beat_pulse = exp(-beat_phase * 6.0) * u_bass;

    // Stereo-Paning (verschiebt das Kaleidoskop-Zentrum)
    float pan = (u_bass_left - u_bass_right) * 0.2;
    vec2 center = vec2(pan, 0.0);
    uv -= center;

    // Globaler Kaleidoskop-Zoom basierend auf Energie
    uv *= 1.0 - u_energy * 0.15;

    // ── 3. KALEIDOSKOP-FALTUNG (Der Raum wird gespiegelt) ──
    float r = length(uv);
    float a = atan(uv.y, uv.x);

    // Basis-Rotation des gesamten Kaleidoskops
    a += u_time * d_rotation_speed * (0.5 + u_energy * 0.5);

    // BEAT BREAK: Auf dem Kickdrum-Schlag "bricht" die Symmetrie auf
    // Wir verschieben den Winkel ruckartig auf Basis des Beats und der Mitten
    a += beat_pulse * sin(r * 20.0) * 0.2;
    
    // Die eigentliche Spiegelungs-Mathematik (Polar Fold)
    float segment_angle = TAU / d_symmetry;
    // Raum in Kuchenstücke teilen
    a = mod(a, segment_angle); 
    // In der Mitte jedes Stücks spiegeln (Zick-Zack-Muster)
    a = abs(a - segment_angle / 2.0); 

    // Zurück in kartesische Koordinaten für den geknickten Raum
    vec2 folded_p = r * vec2(cos(a), sin(a));

    // Mids verzerren den gefalteten Raum (Wobble-Effekt)
    folded_p.x += sin(r * 15.0 - u_time * 3.0) * u_mid * 0.05;

    // ── 4. MUSTER & FARBE ──────────────────────────────────
    // Das gewählte Grundmuster berechnen
    float pattern = get_base_pattern(folded_p, d_style, r, a);
    
    // High-Frequenzen lassen die Kanten schärfer aufblitzen
    float sharp = 0.5 + u_high * 0.5;
    pattern = smoothstep(0.0 - sharp, 0.0 + sharp, pattern);

    // Farbauswahl basierend auf Distanz, Muster und Takt
    float color_t = r * 1.5 - u_time * 0.2 + d_color_shift + pattern * 0.3;
    
    // Bass-Flashes auf die Farbpalette anwenden
    color_t += beat_pulse * 0.4;
    
    vec3 col = get_palette(color_t);
    
    // Kontrast und Helligkeit
    col *= pattern * (0.6 + u_energy * 0.4 + beat_pulse * 0.8);

    // Zentrum weich ausblenden
    col *= smoothstep(0.0, 0.1, r);
    // Vignette
    col *= smoothstep(1.2, 0.4, r);

    // ── 5. FEEDBACK STATE (Glasige Echos) ──────────────────
    vec2 fb_uv = uv_raw;
    
    // Kaleidoskop-Feedback-Zoom zum akustischen Zentrum
    vec2 zoom_center = vec2(0.5) + center * 0.5 * (u_height/u_width);
    fb_uv = (fb_uv - zoom_center) * (1.0 / u_fb_zoom) + zoom_center;
    
    fb_uv -= zoom_center;
    fb_uv = rot2(u_fb_rotation) * fb_uv;
    fb_uv += zoom_center;
    
    // Warp, getrieben von Mitten
    fb_uv.x += sin(fb_uv.y * 10.0 + u_time) * u_fb_warp_x * (0.5 + u_mid);
    fb_uv.y += cos(fb_uv.x * 10.0 - u_time) * u_fb_warp_y * (0.5 + u_mid);
    
    vec3 prev_col = texture(u_prev_frame, clamp(fb_uv, 0.001, 0.999)).rgb;
    prev_col *= u_fb_decay;
    
    // Max-Blend für scharfe, kristalline Spuren (statt weichem Additiv-Nebel)
    col = max(col, prev_col * (0.8 + u_high * 0.2));

    // Tonemapping
    col = 1.0 - exp(-col);
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}