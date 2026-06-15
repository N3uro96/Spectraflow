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

// ── DETERMINISTISCHE HASH-FUNKTIONEN ────────────────────
float dna(float salt) {
    return fract(sin(salt * 92.7463 + u_seed * 13.37) * 43758.5453);
}

// 2D -> 1D Hash für Kacheln
float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y * (1.0 + u_seed * 0.1));
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

void main() {
    vec2 fc = FlutterFragCoord().xy;
    vec2 res = vec2(u_width, u_height);
    vec2 uv_raw = fc / res;
    
    // Aspektkorrigierte, zentrierte UVs (-1 bis 1)
    vec2 p = (fc - res * 0.5) / min(u_width, u_height);

    // ── 1. GENETIK (Die Regeln des Raums) ───────────────────
    // Topologie: 0=Bodenplane, 1=Tunnel, 2=Kugel/Fisheye
    float d_topology = floor(dna(1.0) * 3.0);
    
    // Gitter-Dichte (Anzahl der Kacheln)
    float d_density  = floor(dna(2.0) * 12.0) + 4.0; 
    
    // Gitter-Verzerrung (Wellen, Wirbel, Scherung)
    float d_warp_type = floor(dna(3.0) * 4.0);
    float d_warp_str  = dna(4.0) * 2.0;
    
    // Farb-Logik: 0=Schachbrett, 1=Zufall pro Kachel, 2=Gradient
    float d_color_mode = floor(dna(5.0) * 3.0);
    
    // Scroll-Geschwindigkeit und Richtung
    float d_scroll_x = (dna(6.0) - 0.5) * 2.0;
    float d_scroll_y = (dna(7.0) - 0.5) * 2.0;

    // ── 2. BEAT & AUDIO-DYNAMIK ─────────────────────────────
    float t_bpm = u_time * (max(u_bpm, 60.0) / 60.0);
    float beat_kick = exp(-fract(t_bpm) * 5.0) * u_bass; // Scharfer Impuls
    float half_beat = step(0.5, fract(t_bpm * 0.5)); // Flippt alle 2 Beats

    // Stereo-Trennung für den Bass
    float local_bass = (p.x < 0.0) ? u_bass_left : u_bass_right;

    // ── 3. RAUM-KRÜMMUNG (Topologie) ────────────────────────
    vec2 space;
    
    if (d_topology < 0.5) {
        // TOPOLOGIE 0: Unendliche 3D-Bodenplane (Mode 7 Style)
        float horizon = 0.2 + u_mid * 0.1; // Horizont wackelt leicht
        float y = p.y - horizon;
        
        // Verhindert Division durch Null und biegt den Horizont nach oben
        float z = 1.0 / max(abs(y) + 0.05, 0.01); 
        
        space.x = p.x * z;
        space.y = z;
        
        // Stereo-Panning verschiebt die Kamera
        space.x -= (u_bass_left - u_bass_right) * 0.5 * z;
    } 
    else if (d_topology < 1.5) {
        // TOPOLOGIE 1: Rechteckiger Cyber-Tunnel
        float z = 1.0 / max(max(abs(p.x), abs(p.y)), 0.05);
        
        // Winkel bestimmt, auf welcher Wand wir sind
        float angle = atan(p.y, p.x);
        // Map Winkel zu 4 glatten Wänden
        float wall_u = angle / (PI * 0.5); 
        
        space.x = wall_u;
        space.y = z;
    } 
    else {
        // TOPOLOGIE 2: Gekrümmte Linse / Wurmloch
        float r = length(p);
        float a = atan(p.y, p.x);
        
        // Bass drückt die Linse nach außen
        // Nenner gegen 0/negativ absichern, sonst Inf/NaN -> schwarzer Frame
        float denom = max(1.0 - r * (0.5 + local_bass * 0.3), 0.15);
        float lens = r / denom;

        space.x = a / PI;
        space.y = log(lens + 0.1);
    }

    // ── 4. GITTER-VERZERRUNG (Warp) ─────────────────────────
    float anim_time = u_time * (0.5 + u_energy * 0.5);
    
    if (d_warp_type < 1.0) {
        // Flüssige Wellen
        space.x += sin(space.y * 3.0 + anim_time) * d_warp_str * u_mid;
    } else if (d_warp_type < 2.0) {
        // Zick-Zack Glitch
        space.x += step(0.5, fract(space.y * 5.0)) * d_warp_str * beat_kick * 0.5;
    } else if (d_warp_type < 3.0) {
        // Scherung
        space.x += space.y * d_warp_str * 0.5;
    } else {
        // Wirbelsturm (Rotation um die eigene Achse)
        space = rot2(space.y * d_warp_str * u_mid) * space;
    }

    // Scrolling anwenden
    space.x += anim_time * d_scroll_x;
    space.y -= anim_time * d_scroll_y + beat_kick * 0.5; // Springt nach vorn beim Beat

    // ── 5. KACHEL-BERECHNUNG (Grid) ─────────────────────────
    space *= d_density;
    
    // Aktuelle Kachel-ID (Integer-Koordinaten)
    vec2 id = floor(space);
    // Lokale UVs innerhalb der Kachel (0.0 bis 1.0)
    vec2 grid_uv = fract(space);
    
    // Zentrum der Kachel für Maskierung (-0.5 bis 0.5)
    vec2 cell_center = grid_uv - 0.5;

    // Jede Kachel bekommt eine zufällige "Höhe" basierend auf Audio
    float cell_hash = hash21(id);
    
    // Teile Frequenzen auf die Kacheln auf
    float cell_audio = 0.0;
    if (cell_hash < 0.3) cell_audio = local_bass;
    else if (cell_hash < 0.7) cell_audio = u_mid;
    else cell_audio = u_high;
    
    // Kacheln extrudieren (kleiner werden) wenn sie laut sind
    float extrusion = cell_audio * (0.4 + beat_kick * 0.4);
    
    // Kachel-Form zeichnen (Quadrat mit dynamischem Rand)
    // Wenn Audio laut ist, wird die Kachel kleiner (Inset)
    float edge = max(abs(cell_center.x), abs(cell_center.y));
    float tile_mask = smoothstep(0.45 - extrusion, 0.4 - extrusion, edge);

    // ── 6. FARBBRECHNUNG ────────────────────────────────────
    float color_idx = 0.0;
    
    // Schachbrett-Muster (0 oder 1)
    float checker = mod(id.x + id.y, 2.0);
    // Invertiere das Schachbrett jeden 2. Beat
    checker = abs(checker - half_beat);

    if (d_color_mode < 1.0) {
        // Klassisches Schachbrett (zwei Farben im Wechsel)
        color_idx = checker * 0.5 + cell_audio * 0.2;
    } else if (d_color_mode < 2.0) {
        // Chaos: Jede Kachel hat eine andere Basis-Farbe
        color_idx = cell_hash + u_time * 0.1;
    } else {
        // Gradient: Farbe basiert auf Tiefe/Distanz
        color_idx = space.y * 0.05 - u_time * 0.2;
    }

    vec3 col = get_palette(color_idx);
    
    // Kacheln anwenden (Hintergrund ist schwarz/Schattenfarbe)
    vec3 bg_color = u_pal_shadow * 0.2;
    col = mix(bg_color, col, tile_mask);
    
    // Leuchtende Ränder (Wireframe-Effekt in den Fugen)
    float wireframe = smoothstep(0.48, 0.5, edge);
    col += u_pal_highlight * wireframe * u_high * 2.0;
    
    // Helligkeit basierend auf Audio der jeweiligen Kachel
    // Grund-Helligkeit angehoben, damit das Brett auch bei Stille sichtbar bleibt.
    col *= 0.75 + cell_audio + beat_kick * checker;

    // Dunkler Nebel in der Ferne (Tiefenunschärfe)
    // space.y wurde mit d_density multipliziert -> sehr groß; daher stark
    // gedämpft und gedeckelt, sonst kippt der ganze Frame ins Schwarze.
    float depth_fog = clamp(space.y / (d_density * 18.0), 0.0, 0.65);
    col = mix(col, u_pal_shadow * 0.2, depth_fog);

    // Vignette
    float vig = smoothstep(1.3, 0.3, length(uv_raw - 0.5) * 2.0);
    col *= vig;

    // ── 7. FEEDBACK STATE (Motion Blur & Glow) ──────────────
    vec2 fb_uv = uv_raw;
    
    vec2 zoom_center = vec2(0.5);
    fb_uv = (fb_uv - zoom_center) * (1.0 / u_fb_zoom) + zoom_center;
    
    fb_uv -= zoom_center;
    fb_uv = rot2(u_fb_rotation) * fb_uv;
    fb_uv += zoom_center;
    
    fb_uv.x += sin(fb_uv.y * 5.0 + u_time) * u_fb_warp_x * u_mid;
    fb_uv.y += cos(fb_uv.x * 5.0 - u_time) * u_fb_warp_y * u_mid;
    
    vec3 prev_col = texture(u_prev_frame, clamp(fb_uv, 0.001, 0.999)).rgb;
    
    // Additives Blending für langes Nachglühen der Kacheln
    col = col + prev_col * u_fb_decay * (0.7 + u_energy * 0.3);

    // Tonemapping
    col = 1.0 - exp(-col);
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}