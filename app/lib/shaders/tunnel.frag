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

// ── GENETISCHER CODE (Aus Seed) ──────────────────────────
// Erzeugt Pseudo-Zufallszahlen basierend auf dem Seed und einem "Salt"
// u_seed liegt in [0,1) (in Dart normalisiert) -> GPU-sichere sin()-Argumente.
float dna(float salt) {
    return fract(sin(salt * 78.233 + u_seed * 113.5) * 43758.5453);
}

// ── FARBPALETTE (Weicher Übergang) ────────────────────────
vec3 get_palette(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 col = mix(u_pal_shadow, u_pal_low, smoothstep(0.0, 0.33, t));
    col = mix(col, u_pal_high, smoothstep(0.33, 0.66, t));
    col = mix(col, u_pal_highlight, smoothstep(0.66, 1.0, t));
    return col;
}

// ── HILFSFUNKTIONEN ────────────────────────────────────────
mat2 rot2(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

void main() {
    // ── Setup ───────────────────────────────────────────────
    vec2 fc = FlutterFragCoord().xy;
    vec2 res = vec2(u_width, u_height);
    
    // Normalisierte UVs (0 bis 1)
    vec2 uv_raw = fc / res; 
    
    // Zentrierte UVs (-1 bis 1, Aspekt-korrigiert)
    vec2 p = (fc - res * 0.5) / min(u_width, u_height);

    // ── 1. DNA: Generative Parameter festlegen ────────────
    // Richtung: Rein (1.0) oder Raus (-1.0)
    float d_direction = dna(1.0) > 0.5 ? 1.0 : -1.0;
    
    // Grundform: 0=Kreis, 1=Quadrat, 2=Polygon
    float d_shape = floor(dna(2.0) * 3.0);
    float d_poly_sides = floor(dna(3.0) * 5.0) + 3.0; // 3 bis 8 Seiten
    
    // Muster-Typ: 0=Ringe, 1=Spiralen, 2=Punkte/Grid
    float d_pattern = floor(dna(4.0) * 3.0);
    
    // Tunnel-Ende Typ: 0=Dunkel, 1=Licht, 2=Neutral (Paletten-Rotation)
    float d_end_type = floor(dna(5.0) * 3.0);

    // ── 2. AUDIO & PERSPEKTIVE ─────────────────────────────
    
    // Stereo-Fluchtpunkt-Verschiebung
    // u_stereo ist 0..1, daher die Richtung aus der L/R-Bass-Balance ableiten.
    // Bewusst sanft gehalten, damit der Fluchtpunkt nur leicht wandert.
    float perspective_shift = (u_bass_left - u_bass_right) * 0.12;
    p.x -= perspective_shift;

    // Polarkoordinaten berechnen
    float r = length(p);
    float angle = atan(p.y, p.x);

    // Form-Deformation (aus DNA)
    if (d_shape > 0.5) {
        // Erzeugt Ecken (Quadrat oder Polygon)
        float num_sides = (d_shape < 1.5) ? 4.0 : d_poly_sides;
        float a_segment = angle * num_sides;
        float poly_distortion = cos(a_segment) * 0.1;
        // Mitten-Frequenzen lassen die Ecken vibrieren
        r += poly_distortion * (0.5 + u_mid * 0.5);
    }

    // Tiefe (Perspektive): r=0 ist unendlich weit weg
    // Wir addieren u_high, damit Höhen den Tunnel leicht "zittern" lassen
    float depth = 1.0 / (r + 0.001 + u_high * 0.1);

    // ── 3. BEWEGUNG & MUSTER ───────────────────────────────
    
    // Geschwindigkeit basierend auf BPM und Energy
    // Wir nutzen u_bpm, um eine takt-synchrone Basisgeschwindigkeit zu haben
    float bpm_speed = (u_bpm / 60.0) * u_time;
    float move_speed = (bpm_speed + u_energy * 2.0) * d_direction;
    
    // Animierte Z-Koordinate (Tiefe + Zeit)
    float z_anim = depth + move_speed;

    // Muster-Generierung
    float pattern_raw = 0.0;
    
    // Wir nutzen Mid-Frequenzen, um die Musterdicke zu steuern
    float wave_width = 0.5 + u_mid * 0.5;

    if (d_pattern < 0.5) {
        // Retaillierte Ringe
        pattern_raw = sin(z_anim * 10.0);
    } else if (d_pattern < 1.5) {
        // Spirale
        pattern_raw = sin(z_anim * 10.0 + angle);
    } else {
        // Grid/Punkte (z-Wellen * Winkel-Wellen)
        pattern_raw = sin(z_anim * 10.0) * cos(angle * 6.0);
    }
    
    // Muster schärfen (Licht-Streifen)
    float pattern_sharp = smoothstep(1.0 - wave_width, 1.0, pattern_raw);

    // ── 4. FARBGEBUNG ───────────────────────────────────────
    
    // Basis-Farbkoordinate basierend auf Tiefe und Takt
    float color_t = fract(depth * 0.1 + bpm_speed * 0.05);
    
    // Bassdrum-Akzent: Erzeugt einen Flash-Effekt
    // smoothstep macht den Kick knackiger
    float bass_kick = smoothstep(0.4, 0.9, u_bass);
    
    // Muster-Farbe
    vec3 ring_col = get_palette(color_t + pattern_sharp * 0.2);
    
    // Hintergrund-Farbe (Nebelfarbe in der Ferne)
    vec3 bg_col = u_pal_shadow * 0.5;
    
    // Mix aus Hintergrund und Ringen, intensiviert durch Energie
    vec3 col = mix(bg_col, ring_col, pattern_sharp * (0.8 + u_energy * 0.4));
    
    // Bass drum Akzent auf die gesamte Farbe anwenden
    col += u_pal_highlight * bass_kick * 0.5;

    // ── 5. TUNNEL-ENDE (ZENTRUM) ───────────────────────────
    
    // Maske für das Zentrum (r nahe 0 -> depth sehr hoch)
    float core_mask = smoothstep(20.0, 5.0, depth);
    
    vec3 end_col;
    if (d_end_type < 0.5) {
        // Dunkelheit
        end_col = vec3(0.0);
    } else if (d_end_type < 1.5) {
        // Licht (Gleißend)
        end_col = u_pal_highlight * (1.0 + u_energy * 3.0);
    } else {
        // Neutral (rotiert durch Palette)
        end_col = get_palette(fract(u_time * 0.1));
    }
    
    // Tunnel-Farbe mit Ende-Farbe mischen
    col = mix(end_col, col, core_mask);

    // Vignette (Ränder abdunkeln)
    float vignette = smoothstep(1.2, 0.3, length(uv_raw - 0.5) * 2.0);
    col *= vignette;

    // ── 6. FEEDBACK LOOP (TRAILS) ─────────────────────────
    
    // UVs für den Rückblick leicht transformieren
    vec2 fb_uv = uv_raw;
    
    // 1. Zoom (um das Zentrum des Tunnels, nicht der Screen-Mitte)
    vec2 zoom_center = vec2(0.5 + perspective_shift * 0.5 * (u_height/u_width), 0.5);
    fb_uv = (fb_uv - zoom_center) * (1.0 / u_fb_zoom) + zoom_center;
    
    // 2. Rotation
    fb_uv -= zoom_center;
    fb_uv = rot2(u_fb_rotation) * fb_uv;
    fb_uv += zoom_center;
    
    // 3. Warp (Flüssigkeits-Effekt, gesteuert durch Mids/Highs)
    fb_uv.x += sin(fb_uv.y * 10.0 + u_time) * u_fb_warp_x * (0.2 + u_high);
    fb_uv.y += cos(fb_uv.x * 10.0 - u_time) * u_fb_warp_y * (0.2 + u_mid);
    
    // Sample das vorherige Frame
    vec3 prev_col = texture(u_prev_frame, clamp(fb_uv, 0.001, 0.999)).rgb;
    
    // Decay anwenden (Rückkopplung abschwächen)
    prev_col *= u_fb_decay;
    
    // Blend-Modus: Additiv für leuchtende Trails
    // Gesteuert durch u_energy, damit Trails bei leiser Musik verschwinden
    float trail_strength = 0.5 + u_energy * 0.5;
    col = col + prev_col * trail_strength;

    // Finale Ausgabe
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}