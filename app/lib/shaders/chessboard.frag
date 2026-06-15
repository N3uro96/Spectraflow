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

// u_seed in [0,1) -> GPU-sichere sin()-Argumente.
float dna(float salt) {
    return fract(sin(salt * 78.233 + u_seed * 113.5) * 43758.5453);
}

// Hash pro Kachel
float ch(vec2 c, float salt) {
    return fract(sin(dot(c, vec2(127.1, 311.7)) + salt * 74.7
                     + u_seed * 113.5) * 43758.5453);
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
    vec2 fc  = FlutterFragCoord().xy;
    vec2 res = vec2(u_width, u_height);
    vec2 uv_raw = fc / res;
    vec2 p = (fc - res * 0.5) / min(u_width, u_height);

    // ── 1. GENETIK ─────────────────────────────────────────
    float d_topo    = floor(dna(1.0) * 4.0);        // Raum-Topologie 0..3
    float d_density = floor(dna(2.0) * 8.0) + 5.0;  // 5–12 Kacheln
    float d_skew    = (dna(3.0) - 0.5) * 0.8;       // Scherung
    float d_lognon  = dna(4.0);                     // log-nicht-uniform
    float d_extr    = dna(5.0) * 0.8 + 0.4;         // Extrusions-Stärke
    float d_pulse   = dna(6.0) * 0.6;               // Pulsier-Stärke
    float d_glitch  = dna(7.0);                     // Glitch-Shift
    float d_flip    = dna(8.0) > 0.4 ? 1.0 : 0.0;   // Beat-Farb-Flip
    float d_rotch   = dna(9.0) * 0.18;              // seltene Kachel-Rotation
    float d_colspd  = dna(10.0) * 0.2 + 0.02;
    float d_scroll  = (dna(11.0) - 0.5) * 0.8;

    // ── 2. BEAT & STEREO ───────────────────────────────────
    float t_bpm     = u_time * (max(u_bpm, 60.0) / 60.0);
    float beat      = exp(-fract(t_bpm) * 5.0) * smoothstep(0.15, 0.6, u_bass);
    float beatHard  = step(0.5, exp(-fract(t_bpm) * 14.0));

    bool  isLeft   = uv_raw.x < 0.5;
    float chBass   = isLeft ? u_bass_left : u_bass_right;

    // ── 3. RAUM-TOPOLOGIE (Seed) ───────────────────────────
    vec2 board;
    float depthFade = 0.0;       // 0 = nah/voll sichtbar
    if (d_topo < 0.5) {
        // Perspektiv-Boden (Mode-7)
        float y = abs(p.y) + 0.12;
        float z = 1.0 / y;
        board = vec2(p.x * z, z + u_time * d_scroll);
        board.y += sin(board.x * 2.0 + u_time) * u_energy * 0.4;
        depthFade = clamp((z - 1.0) * 0.06, 0.0, 0.6);
    } else if (d_topo < 1.5) {
        // Fisheye / Linse
        float r = length(p);
        float bulge = 1.0 + u_bass * 0.5 + beat * 0.3;
        float rr = atan(r * bulge) / (PI * 0.5);
        float a = atan(p.y, p.x);
        board = vec2(a / PI, rr * 3.0 - u_time * d_scroll);
        depthFade = smoothstep(0.0, 1.2, r) * 0.4;
    } else if (d_topo < 2.5) {
        // Flexible Ebene / wehendes Tuch
        board = p * 2.2;
        board.x += sin(board.y * 3.0 + u_time * 1.2) * (0.1 + u_mid * 0.4);
        board.y += cos(board.x * 2.5 - u_time) * (0.1 + u_energy * 0.3);
        board.y += u_time * d_scroll;
    } else {
        // Flache, scrollende Ebene (klar & ruhig)
        board = p * 2.0;
        board += vec2(u_time * d_scroll, u_time * d_scroll * 0.5);
    }

    // Scherung + log-nicht-uniforme Streckung
    board.x += board.y * d_skew;
    board.x = mix(board.x, sign(board.x) * log(1.0 + abs(board.x) * 2.0),
                  d_lognon * 0.6);

    // ── 4. GITTER ──────────────────────────────────────────
    vec2 gp = board * d_density;

    // Glitch: ganze Reihen verschieben sich am harten Beat
    float rowShift = (ch(vec2(0.0, floor(gp.y)), 3.0) - 0.5)
                   * d_glitch * (0.4 + chBass * 1.6) * beatHard;
    gp.x += rowShift;

    vec2 cid = floor(gp);
    vec2 f   = fract(gp);

    // ── 5. KACHEL-EIGENSCHAFTEN ────────────────────────────
    float hRot  = ch(cid, 1.0);
    float hBand = ch(cid, 2.0);

    float band = (hBand < 0.4) ? chBass : (hBand < 0.75) ? u_mid : u_high;

    float pulse  = band * d_pulse + beat * 0.25;
    float height = band * d_extr;

    // seltene Kachel-Rotation
    vec2 fc2 = f - 0.5;
    if (hRot < d_rotch) {
        fc2 = rot2(hRot * 30.0 + u_time * 0.5) * fc2;
    }

    // Kachel-Form mit 3D-Bevel
    float dEdge = max(abs(fc2.x), abs(fc2.y));   // 0 Mitte .. 0.5 Rand
    float inset = 0.42 - pulse * 0.28;
    float tile  = smoothstep(inset + 0.03, inset - 0.03, dEdge);
    float rim   = smoothstep(inset - 0.12, inset, dEdge) * tile;   // Rand-Glanz (3D)
    float grout = smoothstep(inset, inset + 0.02, dEdge)
                * (1.0 - smoothstep(inset + 0.07, inset + 0.11, dEdge)); // Fuge

    // ── 6. FARBE ───────────────────────────────────────────
    float parity = mod(cid.x + cid.y, 2.0);
    if (d_flip > 0.5) parity = abs(parity - beatHard);   // Beat-Flip

    float baseT = parity > 0.5 ? 0.7 : 0.18;
    float ct    = fract(baseT + height * 0.3 + ch(cid, 5.0) * 0.15
                        + u_time * d_colspd);
    vec3 tilecol = get_palette(ct);

    // Hintergrund + Kacheln (Helligkeit aus Extrusion/Band, Grund-Floor sichtbar)
    vec3 col = u_pal_shadow * 0.08;
    col = mix(col, tilecol * (0.3 + height * 1.1 + band * 0.7 + beat * 0.4), tile);

    // 3D-Rand-Glanz + glühende Fugen
    col += u_pal_highlight * rim * (0.25 + u_high * 0.8);
    col += u_pal_highlight * grout * (0.4 + u_high * 1.2 + beat * 0.6);

    // Beat-Farbakzent auf aktiven Kacheln
    col = mix(col, u_pal_highlight, beat * 0.3 * tile * step(0.3, band));

    // Sanfter Tiefen-Nebel (gedeckelt -> nie schwarz)
    col = mix(col, u_pal_shadow * 0.15, depthFade);

    // Vignette
    col *= smoothstep(1.25, 0.35, length(uv_raw - 0.5) * 2.0);

    // ── 7. FEEDBACK STATE ──────────────────────────────────
    vec2 fb = uv_raw - 0.5;
    fb /= u_fb_zoom;
    fb = rot2(-u_fb_rotation) * fb;
    fb.x += sin(fb.y * 6.0 + u_time) * u_fb_warp_x * u_mid;
    fb.y += cos(fb.x * 6.0 - u_time) * u_fb_warp_y * u_mid;
    fb += 0.5;

    vec2 ef = smoothstep(0.0, 0.04, fb) * (1.0 - smoothstep(0.96, 1.0, fb));
    vec3 prev = texture(u_prev_frame, clamp(fb, 0.001, 0.999)).rgb;
    col = max(col, prev * u_fb_decay * (ef.x * ef.y) * 0.88);

    // Tonemapping
    col = 1.0 - exp(-col);
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
