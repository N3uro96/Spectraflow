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

uniform sampler2D u_feedback;

out vec4 fragColor;

// ─────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

// Tunnel Palette
vec3 tunnelColor(float t, float time) {
    float hue = fract(t * 0.3 + time * 0.05);
    float sat = 0.7 + u_energy * 0.3;
    float val = 0.6 + u_bass * 0.4;
    return hsv2rgb(vec3(hue, sat, val));
}

void main() {
    vec2 fragCoord = FlutterFragCoord().xy;
    vec2 uv        = fragCoord / vec2(u_width, u_height);
    vec2 center    = uv - 0.5;
    center.x      *= u_width / u_height;

    // ── Feedback Warp ──
    vec2 warped = center;

    // Zoom – Bass treibt den Sog
    float zoom = 1.015 + u_bass * 0.02;
    warped *= zoom;

    // Rotation – Mid dreht langsam
    float angle = u_time * 0.08 + u_mid * 0.15;
    warped = rot(angle) * warped;

    // Warp – High erzeugt Verwirbelung
    warped += vec2(
        sin(warped.y * 4.0 + u_time * 0.5) * 0.015 * (1.0 + u_high),
        cos(warped.x * 4.0 + u_time * 0.5) * 0.015 * (1.0 + u_high)
    );

    // Vorherigen Frame sampeln + Decay
    vec2 feedbackUV = warped / (u_width / u_height) + 0.5;
    feedbackUV      = clamp(feedbackUV, 0.0, 1.0);
    vec4 prev       = texture(u_feedback, feedbackUV);

    // Decay – Energy bestimmt wie schnell Bild erneuert wird
    float decay = 0.96 - u_energy * 0.015;
    prev.rgb   *= decay;

    // ── Tunnel Geometrie ──
    vec2  p = center;
    float r = length(p);
    float a = atan(p.y, p.x);

    // Tunnel Tiefe
    float speed  = 0.4 + u_bass * 0.3;
    float tunnel = fract(0.8 / (r + 0.1) - u_time * speed);

    // Speichen (6 Stück, DNA würde das steuern)
    float spokes  = 6.0;
    float spoke   = smoothstep(0.92, 0.98,
                    abs(sin(a * spokes * 0.5)));

    // Stereo: L/R leicht versetzt
    float stereo_offset = u_stereo * 0.05;
    float tunnel_l = fract(0.8 / (length(p + vec2(stereo_offset, 0.0)) + 0.1)
                    - u_time * speed);
    float tunnel_r = fract(0.8 / (length(p - vec2(stereo_offset, 0.0)) + 0.1)
                    - u_time * speed);

    // ── Farben ──
    vec3 col_center = tunnelColor(tunnel, u_time);
    vec3 col_l      = tunnelColor(tunnel_l + 0.1, u_time);
    vec3 col_r      = tunnelColor(tunnel_r + 0.2, u_time);

    // Stereo Mischung
    vec3 col = mix(col_center,
                   mix(col_l, col_r, 0.5),
                   u_stereo * 0.3);

    // Speichen dunkler
    col *= mix(1.0, 0.2, spoke);

    // Zentrum-Glow (Beat reagiert)
    float glow  = exp(-r * (4.0 - u_energy * 2.0));
    glow       *= 1.0 + u_bass * 0.5;
    col        += tunnelColor(u_time * 0.1, u_time) * glow * 0.6;

    // Tunnel Helligkeit
    float brightness = 0.4 + tunnel * 0.6;
    col             *= brightness;

    // ── Feedback Mischen ──
    // Neue Geometrie über alten Frame legen
    col = mix(prev.rgb, col, 0.2 + u_energy * 0.1);

    // ── Post Processing ──
    // Vignette
    float vig = 1.0 - dot(center * 1.2, center * 1.2);
    vig        = clamp(vig, 0.0, 1.0);
    col       *= vig;

    // Chromatic Aberration auf Beat
    // (verschiebt RGB Kanäle leicht)
    float ca  = u_bass * 0.008;
    if (ca > 0.001) {
        vec2 ca_uv_r = feedbackUV + vec2(ca,  0.0);
        vec2 ca_uv_b = feedbackUV - vec2(ca,  0.0);
        col.r = mix(col.r, texture(u_feedback, ca_uv_r).r, 0.3);
        col.b = mix(col.b, texture(u_feedback, ca_uv_b).b, 0.3);
    }

    // Beat Flash
    col += u_bass * 0.06 * tunnelColor(u_time * 0.2, u_time);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
