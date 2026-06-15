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

// ── DETERMINISTISCHER HASH ────────────────────────────────
float ph(float id, float salt) {
    return fract(sin(id * 127.1 + salt * 311.7 + u_seed * 0.123) * 43758.5453);
}

float dna(float salt) {
    return fract(sin(salt * 92.7463 + u_seed * 0.005) * 43758.5453);
}

vec3 pal(float t) {
    t = clamp(t, 0.0, 1.0);
    if (t < 0.333) return mix(u_pal_shadow,   u_pal_low,       t * 3.0);
    if (t < 0.667) return mix(u_pal_low,        u_pal_high,      (t - 0.333) * 3.0);
    return               mix(u_pal_high,       u_pal_highlight, (t - 0.667) * 3.0);
}

mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// ── OPTIMIERTE PARTIKEL-SHAPES (Branchless / Ohne If-Statements) ──
float get_shape_contribution(vec2 d, float type, float sz, vec2 vd) {
    float r = length(d) / max(sz, 0.001);
    
    // Wir berechnen die mathematischen Grundformen parallel und blenden via step()
    float shape0 = exp(-r * r * 4.0); // Gauss Dot
    
    float cx = exp(-(d.y/sz)*(d.y/sz) * 24.0) * exp(-(d.x/sz)*(d.x/sz) * 0.5);
    float cy = exp(-(d.x/sz)*(d.x/sz) * 24.0) * exp(-(d.y/sz)*(d.y/sz) * 0.5);
    float shape1 = max(cx, cy) + shape0 * 0.5; // Stern / Kreuz
    
    vec2 vp = vec2(-vd.y, vd.x);
    float shape2 = exp(-(pow(dot(d, vd)/(sz*2.5), 2.0) + pow(dot(d, vp)/(sz*0.3), 2.0)) * 2.0); // Kometen-Linie
    
    float shape3 = exp(-pow(r - 0.65, 2.0) * 35.0); // Ring
    
    float v = max(0.0, 1.0 - r * r);
    float shape4 = v * v * v * 1.5; // Organischer Blob
    
    float sq = max(abs(d.x), abs(d.y)) / sz;
    float shape5 = smoothstep(0.85, 0.70, sq); // Cyber-Pixel
    
    float along_b = max(0.0, dot(d, -vd)) / sz;
    float perp = length(d - dot(d, vd) * vd) / sz;
    float shape6 = exp(-along_b * 1.5 - perp * perp * 20.0); // Funken-Schweif
    
    float ha = mod(atan(d.y, d.x), PI / 3.0);
    float arm = 1.0 - min(ha, PI / 3.0 - ha) / (PI / 6.0);
    float shape7 = exp(-r * r * 2.0) * (0.1 + arm * 3.0 * exp(-r * r * 10.0)); // Kristall

    // Branchless Selection: Spart GPU-Zyklen gegenüber harten If-Slices
    float c = 0.0;
    c += shape0 * step(0.0, type) * step(type, 0.5);
    c += shape1 * step(0.5, type) * step(type, 1.5);
    c += shape2 * step(1.5, type) * step(type, 2.5);
    c += shape3 * step(2.5, type) * step(type, 3.5);
    c += shape4 * step(3.5, type) * step(type, 4.5);
    c += shape5 * step(4.5, type) * step(type, 5.5);
    c += shape6 * step(5.5, type) * step(type, 6.5);
    c += shape7 * step(6.5, type);
    
    return c;
}

void main() {
    vec2 fc = FlutterFragCoord().xy;
    vec2 res = vec2(u_width, u_height);
    float asp = u_width / u_height;

    // ── GENETISCHER CODE (Zufall über Seed) ──────────────────
    float d_type_a    = floor(dna(1.0) * 8.0);          // Primärer Typ (0-7)
    float d_type_b    = floor(dna(2.0) * 8.0);          // Sekundärer Typ (0-7)
    float d_count     = floor(dna(3.0) * 33.0) + 32.0;  // 32-64 Partikel
    float d_scale     = dna(4.0) * 0.5 + 0.3;           // System-Größe
    float d_behavior  = floor(dna(5.0) * 3.0);          // 0=Orbit, 1=Chaos-Explosion, 2=DNA-Doppelhelix
    float d_speed     = dna(6.0) * 1.2 + 0.5;           // Grundgeschwindigkeit
    float d_size      = dna(7.0) * 0.03 + 0.02;         // Partikelgröße
    float d_clrdrift  = dna(8.0) * 0.4 + 0.1;           // Farbänderung
    float d_z_range   = dna(9.0) * 1.5 + 0.5;           // Tiefenschärfe-Bereich

    // ── BEAT-DYNAMIK ───────────────────────────────────────
    // Takt-synchrone Phasensteuerung über BPM
    float beat_time = u_time * (max(u_bpm, 60.0) / 60.0);
    float beat_pulse = exp(-fract(beat_time) * 4.0) * u_bass; // Knackiger Kontroll-Impuls
    
    float speed_mod = 1.0 + u_energy * 2.0;
    float stereo_push = u_stereo * 0.35; // Versatz basierend auf Balance

    // Fragment-Setup
    vec2 uv_raw = fc / res;
    vec2 fp = (uv_raw - 0.5) * vec2(asp, 1.0) * 2.0;

    vec3 accumulation = vec3(0.0);

    // ── PARTIKEL-SCHLEIFE ──────────────────────────────────
    for (int i = 0; i < 64; i++) {
        if (float(i) >= d_count) break;
        float id = float(i);

        // Individuelle Genetik pro Partikel
        float p_radius  = (ph(id, 1.0) * 0.6 + 0.2) * d_scale;
        float p_speed   = (ph(id, 2.0) - 0.5) * 2.0 * d_speed;
        float p_phase   = ph(id, 3.0) * TAU;
        float z_base    = ph(id, 4.0) * d_z_range + 0.4;
        float p_hue     = ph(id, 5.0);
        float p_sz_mod  = ph(id, 6.0) * 0.5 + 0.7;
        float p_select  = ph(id, 7.0) > 0.65 ? d_type_b : d_type_a;

        // Kinematik-Modul (Verhalten aus Seed bestimmt)
        vec3 pos = vec3(0.0);
        float t_animated = u_time * p_speed * speed_mod;

        if (d_behavior < 0.5) {
            // Verhalten 0: Strukturierter 3D-Orbit
            pos.x = sin(t_animated + p_phase) * p_radius;
            pos.y = cos(t_animated + p_phase) * p_radius * 0.8;
            pos.z = z_base + sin(t_animated * 0.5) * 0.3;
            // Beat pumpen: Radius weitet sich im Takt
            pos.xy *= (1.0 + beat_pulse * 0.25);
        } 
        else if (d_behavior < 1.5) {
            // Verhalten 1: Regenerative Chaos-Explosion
            float lifetime = fract(t_animated * 0.2 + p_phase);
            float explode_speed = p_radius * 2.0;
            vec2 dir = vec2(sin(p_phase), cos(p_phase));
            pos.xy = dir * lifetime * explode_speed;
            pos.z = z_base * (1.0 - lifetime * 0.5);
            // Reagiert auf Mids bei der Expansion
            pos.xy += dir * u_mid * 0.15;
        } 
        else {
            // Verhalten 2: Audioreaktiver Doppelhelix-Vortex
            float angle = t_animated + id * 0.2;
            pos.x = sin(angle) * (p_radius * 0.4 + u_bass * 0.1);
            pos.y = (ph(id, 8.0) - 0.5) * 2.0 + fract(t_animated * 0.1); // Wandert vertikal
            if(pos.y > 1.0) pos.y -= 2.0;
            pos.z = z_base + cos(angle) * 0.2;
        }

        // Stereo & Audio-Offsets aufprägen
        pos.x += stereo_push;
        pos.x += sin(u_time * 2.0 + p_phase) * u_mid * 0.08; // Mid-Wackeln
        pos.y += cos(u_time * 1.5 + p_phase) * u_high * 0.05; // High-Zittern

        // 3D-Projektion auf den Bildschirm
        float z_safe = max(pos.z, 0.1);
        vec2 screen_pos = pos.xy / z_safe;
        float current_sz = d_size * p_sz_mod / z_safe;

        // Distanz-Check für Performance-Schonung
        vec2 dvec = fp - screen_pos;
        if (length(dvec) > current_sz * 4.0) continue;

        // Bewegungsvektor für Richtungs-Shapes (Komet, Linie)
        vec2 vd = normalize(vec2(-sin(t_animated + p_phase), cos(t_animated + p_phase)) + vec2(0.0001, 0.0));

        // Berechne Form-Beitrag
        float intensity = get_shape_contribution(dvec, p_select, current_sz, vd);
        if (intensity < 0.005) continue;

        // Farb-Pipeline
        float depth_gradient = 1.0 - clamp(pos.z / (d_z_range + 0.4), 0.0, 1.0);
        float color_coord = fract(p_hue + depth_gradient * 0.3 + u_time * d_clrdrift * 0.05);
        vec3 p_color = pal(color_coord);

        // Licht-Sättigung berechnen (Nähe bringt Helligkeit, Bass flasht auf)
        float brightness = (1.2 / z_safe) * (0.7 + u_energy * 0.5 + beat_pulse * 0.8);
        accumulation += p_color * intensity * brightness;
    }

    // Grund-Farbton
    vec3 col = u_pal_shadow * 0.03 + accumulation;

    // High-Frequenzen: Subtiles Sternenglimmern im fernen Hintergrund
    float stars = max(0.0, sin(fp.x * 120.0) * cos(fp.y * 120.0));
    col += u_pal_highlight * pow(stars, 4.0) * u_high * 0.15;

    // Vignette
    float vig = 1.0 - smoothstep(0.4, 0.95, length(uv_raw - 0.5) * 2.0);
    col *= vig;

    // ── FEEDBACK STATE (Trails verarbeiten) ─────────────────
    vec2 fb = uv_raw - 0.5;
    fb /= u_fb_zoom;
    fb = rot2(-u_fb_rotation) * fb;
    
    // Warp-Modulation getrieben durch Audio-Mids für dynamische Verflüssigung
    fb.x += sin(fb.y * 7.0 + u_time) * u_fb_warp_x * (0.4 + u_mid * 0.6);
    fb.y += cos(fb.x * 7.0 - u_time) * u_fb_warp_y * (0.4 + u_mid * 0.6);
    fb += 0.5;

    // Boundary Protection für die Framebuffer-Textur
    vec2 edge_fade = smoothstep(0.0, 0.03, fb) * (1.0 - smoothstep(0.97, 1.0, fb));
    float fade_factor = edge_fade.x * edge_fade.y;
    
    vec3 prev_frame_color = texture(u_prev_frame, clamp(fb, 0.001, 0.999)).rgb;
    vec3 trails = prev_frame_color * u_fb_decay * fade_factor;

    // Weiches, additives Max-Blending verhindert Übersteuerung
    col = max(col, trails * 0.92);
    
    // Tonemapping-Schutz vor Farbclipping
    col = 1.0 - exp(-col);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}