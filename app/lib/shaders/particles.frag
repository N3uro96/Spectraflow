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

// ── DNA ────────────────────────────────────────────────────
uniform float u_dna_zoom;        // 11  → Partikelgröße (Punkt/Ring/Stern)
uniform float u_dna_rotation;    // 12  → Orbitalgeschwindigkeit + Richtung
uniform float u_dna_warp_x;      // 13  → Fließfeld X
uniform float u_dna_warp_y;      // 14  → Fließfeld Y
uniform float u_dna_wave_freq;   // 15  → Stern-Punkte / Oszillationsfrequenz
uniform float u_dna_color_speed; // 16  → Farb-Cycling-Speed
uniform float u_dna_spokes;      // 17  → Anzahl Hero-Partikel (2–10)
uniform float u_dna_bass_react;  // 18  → Bass-Reaktivität
uniform float u_dna_mid_react;   // 19  → Mid-Reaktivität (Tanzamplitude)
uniform float u_dna_phase;       // 20  → Globaler Phasenoffset

// ── Palette ────────────────────────────────────────────────
uniform vec3 u_pal_shadow;    // 21–23
uniform vec3 u_pal_low;       // 24–26
uniform vec3 u_pal_high;      // 27–29
uniform vec3 u_pal_highlight; // 30–32

// ── Feedback ───────────────────────────────────────────────
uniform float u_fb_zoom;      // 33
uniform float u_fb_rotation;  // 34
uniform float u_fb_decay;     // 35
uniform float u_fb_warp_x;    // 36
uniform float u_fb_warp_y;    // 37

uniform sampler2D u_prev_frame; // sampler 0

out vec4 fragColor;

// ── Palette ────────────────────────────────────────────────
vec3 pal(float t) {
    t = clamp(t, 0.0, 1.0);
    if (t < 0.333) return mix(u_pal_shadow,    u_pal_low,       t * 3.0);
    if (t < 0.667) return mix(u_pal_low,        u_pal_high,      (t - 0.333) * 3.0);
    return               mix(u_pal_high,        u_pal_highlight, (t - 0.667) * 3.0);
}

// ── Hash (deterministisch, schnell) ───────────────────────
float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    return fract(p * (p + p));
}

vec2 hash21(vec2 p) {
    p = fract(p * vec2(0.1031, 0.1030));
    p += dot(p, p.yx + 33.33);
    return fract((p.xx + p.yx) * p.xy);
}

// ── Partikel-Erscheinung ───────────────────────────────────
// zoom_t (0-1): 0=Leuchtpunkt, 0.5=Ring/Blase, 1=Stern/Funke
// n_pts: Anzahl Sternzacken (aus DNA wave_freq)
float particle_glow(vec2 delta, float r, float n_pts, float zoom_t) {
    float d = length(delta);

    // Leuchtpunkt (Gauss)
    float g_point = exp(-d * d / (r * r * 0.3));

    // Ring / Blase (Donut)
    float g_ring  = exp(-pow(d - r * 0.85, 2.0) / (r * r * 0.06));

    // Stern / Funke (winkelmodulierter Glow)
    float ang     = atan(delta.y, delta.x);
    float ang_mod = 0.45 + 0.55 * abs(cos(ang * n_pts));
    float g_star  = exp(-d / (r * ang_mod * 1.2));

    // Sanfter 3-Wege-Blend: 0=Punkt, 0.5=Ring, 1=Stern
    float t2 = zoom_t * 2.0;
    return mix(mix(g_point, g_ring, clamp(t2, 0.0, 1.0)),
               g_star, clamp(t2 - 1.0, 0.0, 1.0));
}

void main() {
    vec2 uv_raw = FlutterFragCoord().xy / vec2(u_width, u_height);
    vec2 uv     = uv_raw * 2.0 - 1.0;
    uv.x       *= u_width / u_height;
    vec2 uv0    = uv;

    // ── Milkdrop Feedback (Trails automatisch) ─────────────
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
                  * u_fb_decay * (ef.x * ef.y);

    // ── Beat ───────────────────────────────────────────────
    float beat_dur   = 60.0 / max(u_bpm, 60.0);
    float beat_phase = fract(u_time / beat_dur);
    float beat_kick  = exp(-beat_phase * 7.0);

    // ── Gemeinsame DNA-Parameter ───────────────────────────
    // Appearance mode: 0=Punkt, 0.5=Ring, 1.0=Stern
    float zoom_t = clamp((u_dna_zoom - 0.7) / 0.7, 0.0, 1.0);
    // Stern-Punkte: 3–7 je nach DNA wave_freq
    float n_pts  = 3.0 + floor(u_dna_wave_freq * 0.5);
    // Warp-Magnitude bestimmt Bewegungsmodus (Orbit/Flow/Explosion)
    float warp_mag = length(vec2(u_dna_warp_x, u_dna_warp_y));

    vec3 col = vec3(0.0);

    // ════════════════════════════════════════════════════════
    // SCHICHT 1: Worley-Partikelfeld (Hintergrund, viele kleine Partikel)
    // ════════════════════════════════════════════════════════
    {
        // Dichte: DNA spokes treibt Anzahl Zellen
        float density = 3.5 + u_dna_spokes * 1.4; // 6.3–17.5 Zellen/Achse

        // Globale Fließbewegung: DNA warp schiebt das gesamte Feld
        vec2 flow_off = vec2(u_dna_warp_x, u_dna_warp_y) * u_time * 0.05;
        vec2 grid_uv  = (uv + flow_off) * density * 0.5; // 0.5 → Zellen in UV-Raum
        vec2 cell_id  = floor(grid_uv);
        vec2 cell_uv  = fract(grid_uv);

        // Partikelgröße in UV-Raum (passt sich Dichte an)
        float glow_r = 0.45 / density;

        for (int dx = -1; dx <= 1; dx++) {
            for (int dy = -1; dy <= 1; dy++) {
                vec2 nb = cell_id + vec2(float(dx), float(dy));
                vec2 h  = hash21(nb + u_dna_phase * 0.0007);

                // Individuelle Partikel-Eigenschaften
                float phase_p  = h.x * 6.28318;
                float speed_p  = 0.25 + h.x * 0.5;
                // Orbitrichtung: Hälfte CW, Hälfte CCW (± durch DNA rotation verzerrt)
                float dir_p    = (h.y > 0.5 ? 1.0 : -1.0) * sign(u_dna_rotation + 0.01);

                // Orbitalradius: Bass weitet aus, Beat pulsiert
                float r_orb = 0.06 + h.y * 0.14
                            + u_bass * u_dna_bass_react * 0.10
                            + beat_kick * u_dna_bass_react * 0.06;

                float t_p  = u_time * speed_p * abs(u_dna_wave_freq) * 0.25 + phase_p;
                vec2 orbit = r_orb * vec2(cos(t_p * dir_p), sin(t_p * dir_p));

                // Mid "Tanz": Oszillation senkrecht zur Orbit
                vec2 perp_orb = vec2(-sin(t_p * dir_p), cos(t_p * dir_p));
                orbit += perp_orb * u_mid * u_dna_mid_react * 0.04
                       * sin(t_p * 2.1 + h.y * 6.28318);

                // Partikelposition im Zell-Raum
                vec2 p_cell = vec2(0.5) + orbit;

                // Delta in UV-Raum (nicht in Zell-Raum → korrekte Distanz)
                vec2 delta = (cell_uv - (vec2(float(dx), float(dy)) + p_cell))
                           / (density * 0.5);

                float g = particle_glow(delta, glow_r, n_pts, zoom_t);

                // Farbe: Paletten-Hue aus Zellposition + Zeit
                float hue = hash11(h.x * 73.1) + u_time * 0.04 * u_dna_color_speed
                          + u_dna_phase / 6.28318;
                vec3 pcol = pal(fract(hue));

                float bright = 0.5 + u_energy * 0.5 + beat_kick * 0.4 * u_dna_bass_react;
                col += pcol * g * bright * 0.7;
            }
        }
    }

    // ════════════════════════════════════════════════════════
    // SCHICHT 2: Hero-Partikel (2–10 große, prominent tanzende)
    // ════════════════════════════════════════════════════════
    {
        float n_float  = max(2.0, u_dna_spokes);
        float glow_r   = 0.07 + u_dna_zoom * 0.05; // deutlich größer als Worley

        for (int i = 0; i < 10; i++) {
            // Sanfter Fade-Out statt hartem Cut
            float isActive = clamp(n_float - float(i), 0.0, 1.0);
            if (isActive == 0.0) continue;

            float fi  = float(i);
            vec2  h   = hash21(vec2(fi * 13.7, fi * 7.31) + u_dna_phase * 0.002);
            float phase_i = h.x * 6.28318;
            float speed_i = 0.4 + h.x * 0.6;

            // ── Orbitalposition ──────────────────────────────
            // Partikel i → Grundwinkel gleichmäßig verteilt + Hash-Offset
            float theta0 = (fi / n_float) * 6.28318 + phase_i;
            float omega  = u_dna_rotation * 0.7 + (h.y - 0.5) * 0.3;
            float theta  = theta0 + u_time * omega;

            // Orbitalradius: innen (i=0) klein, außen (i=max) groß
            float r_base = 0.12 + (fi / max(n_float - 1.0, 1.0)) * 0.65 + h.y * 0.1;

            // Bass weitet die Orbit aus (Explosion-Effekt)
            r_base += u_bass * u_dna_bass_react * 0.28;
            // Beat-Kick: kurzfristige Expansion → Funkeneffekt
            r_base += beat_kick * u_dna_bass_react * 0.18;

            // Orbitalposition
            vec2 orbit_pos = vec2(cos(theta), sin(theta)) * r_base;

            // ── DNA Fließfeld (Schwarm-Drift) ────────────────
            // warp_mag nah 0 = reine Orbit, warp_mag nah 1 = Drift-dominiert
            vec2 drift = vec2(u_dna_warp_x, u_dna_warp_y)
                       * sin(u_time * speed_i * 0.4 + phase_i) * 0.35;
            float drift_blend = warp_mag / 0.85;

            // ── Mid "Tanz" ───────────────────────────────────
            vec2 perp = vec2(-sin(theta), cos(theta));
            vec2 dance = perp * u_mid * u_dna_mid_react
                       * sin(u_time * u_dna_wave_freq * 0.6 + h.y * 6.28318) * 0.18;

            // ── Finale Position ──────────────────────────────
            vec2 pos = mix(orbit_pos, orbit_pos + drift, drift_blend) + dance;

            // ── Beitrag zu diesem Pixel ──────────────────────
            vec2 delta = uv - pos;
            float g    = particle_glow(delta, glow_r, n_pts, zoom_t) * 4.0 * isActive;

            // Farbe: jeder Hero bekommt eigene Palettenfarbe
            float hue_i = fi / n_float + u_time * 0.05 * u_dna_color_speed
                        + u_dna_phase / 6.28318;
            vec3 pcol   = pal(fract(hue_i));

            // Stereo: L/R-Hero leuchten mit L/R-Bass
            float stereo_mod = (i % 2 == 0)
                ? (1.0 + u_bass_left  * u_stereo * 0.6)
                : (1.0 + u_bass_right * u_stereo * 0.6);

            float bright = (0.8 + u_energy * 0.5 + beat_kick * 0.5 * u_dna_bass_react)
                         * stereo_mod;

            col += pcol * g * bright;
        }
    }

    // ── Beat-Explosion: globaler Helligkeitspuls ───────────
    col += beat_kick * 0.08 * u_pal_highlight;
    col *= 1.0 + u_energy * 0.3;

    // ── Vignette ───────────────────────────────────────────
    float vig = 1.0 - dot(uv0 * 1.0, uv0 * 1.0);
    col *= clamp(vig, 0.0, 1.0);

    // ── Feedback Composite (Trails automatisch) ────────────
    col = feedback + col;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
