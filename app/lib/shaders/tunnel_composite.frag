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

out vec4 fragColor;

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

vec3 tunnelColor(float t, float time, float energy) {
    float hue = fract(t * 0.3 + time * 0.05);
    float sat  = 0.7 + energy * 0.3;
    float val  = 0.5 + energy * 0.5;
    return hsv2rgb(vec3(hue, sat, val));
}

void main() {
    vec2 fragCoord = FlutterFragCoord().xy;
    vec2 uv        = fragCoord / vec2(u_width, u_height);
    vec2 center    = uv - 0.5;
    center.x      *= u_width / u_height;

    // ── Beat Phase aus BPM berechnen ──
    float beat_duration = 60.0 / max(u_bpm, 60.0);
    float beat_phase    = fract(u_time / beat_duration);
    float beat_pulse    = smoothstep(1.0, 0.0, beat_phase * 4.0);

    // ── Stereo Differenz ──
    float stereo_diff = u_bass_left - u_bass_right;

    // ── Warp ──
    vec2 warped = center;

    // Zoom: Bass + Beat Puls
    float zoom = 1.015
        + u_bass   * 0.025
        + beat_pulse * 0.015;
    warped *= zoom;

    // Rotation: Mid + Stereo Differenz dreht den Tunnel
    float angle = u_time * 0.08
        + u_mid * 0.15
        + stereo_diff * 0.2;
    warped = rot(angle) * warped;

    // Warp: High + Beat
    float warp_strength = 0.015 * (1.0 + u_high * 2.0 + beat_pulse * 0.5);
    warped += vec2(
        sin(warped.y * 4.0 + u_time * 0.7) * warp_strength,
        cos(warped.x * 4.0 + u_time * 0.5) * warp_strength
    );

    // ── Tunnel Geometrie ──
    vec2  p = center;
    float r = length(p);
    float a = atan(p.y, p.x);

    // Tunnel Tiefe: Bass beschleunigt
    float speed  = 0.35 + u_bass * 0.4 + beat_pulse * 0.15;
    float tunnel = fract(0.8 / (r + 0.05) - u_time * speed);

    // Speichen
    float spokes = 6.0;
    float spoke  = smoothstep(0.90, 0.97,
                   abs(sin(a * spokes * 0.5)));

    // ── Echtes Stereo ──
    // Linker Kanal → linke Seite reagiert stärker
    float stereo_offset = u_stereo * 0.04;
    vec2  p_left  = p + vec2( stereo_offset * u_bass_left,  0.0);
    vec2  p_right = p + vec2(-stereo_offset * u_bass_right, 0.0);

    float tunnel_l = fract(0.8 / (length(p_left)  + 0.05) - u_time * speed);
    float tunnel_r = fract(0.8 / (length(p_right) + 0.05) - u_time * speed);

    // ── Farben ──
    vec3 col_c = tunnelColor(tunnel,   u_time, u_energy);
    vec3 col_l = tunnelColor(tunnel_l, u_time + 0.1, u_energy);
    vec3 col_r = tunnelColor(tunnel_r, u_time + 0.2, u_energy);

    // Stereo Mischung: L/R getrennt nach links/rechts
    float lr_mix = uv.x; // 0 = ganz links, 1 = ganz rechts
    vec3  col    = mix(
        mix(col_c, col_l, u_stereo * 0.4 * (1.0 - lr_mix)),
        mix(col_c, col_r, u_stereo * 0.4 * lr_mix),
        u_stereo * 0.3
    );

    // Speichen
    col *= mix(1.0, 0.15, spoke);

    // Tunnel Helligkeit
    col *= 0.3 + tunnel * 0.7;

    // ── Glow vom Zentrum ──
    float glow = exp(-r * (3.5 - u_energy * 1.5));
    glow      *= 1.0 + u_bass * 0.8 + beat_pulse * 0.5;
    col       += tunnelColor(u_time * 0.08, u_time, u_energy) * glow * 0.7;

    // ── Beat Flash ──
    col += beat_pulse * 0.08 * tunnelColor(u_time * 0.2, u_time, 1.0);

    // ── Vignette ──
    float vig = 1.0 - dot(center * 1.3, center * 1.3);
    col      *= clamp(vig, 0.0, 1.0);

    // ── Chromatische Aberration auf Bass ──
    float ca     = u_bass * 0.006 + beat_pulse * 0.004;
    vec2  p_ca_r = center + vec2(ca, 0.0);
    vec2  p_ca_b = center - vec2(ca, 0.0);
    float r_ca_r = length(p_ca_r);
    float r_ca_b = length(p_ca_b);
    float t_ca_r = fract(0.8 / (r_ca_r + 0.05) - u_time * speed);
    float t_ca_b = fract(0.8 / (r_ca_b + 0.05) - u_time * speed);
    col.r = mix(col.r, tunnelColor(t_ca_r, u_time, u_energy).r, 0.3);
    col.b = mix(col.b, tunnelColor(t_ca_b, u_time, u_energy).b, 0.3);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
