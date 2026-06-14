#include <flutter/runtime_effect.glsl>

uniform float u_time;
uniform float u_width;
uniform float u_height;
uniform float u_bass;
uniform float u_mid;
uniform float u_high;
uniform float u_energy;
uniform float u_bpm;
uniform float u_beat_phase;
uniform float u_beat_onset;
uniform float u_stereo;

out vec4 fragColor;

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec2 fc  = FlutterFragCoord().xy;
    vec2 uv  = fc / vec2(u_width, u_height);
    vec2 uvc = uv * 2.0 - 1.0;
    uvc.x   *= u_width / u_height;

    vec3 col = vec3(0.0);

    // Hintergrund – reagiert auf Bass
    vec2 p = uvc;
    p += vec2(0.1, 0.1) * sin(p.yx * 3.0 + u_time * 0.5);
    p  = rot(u_time * 0.05 + u_mid * 0.2) * p;
    p *= 1.2 + u_bass * 0.3;

    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        p = abs(p) / dot(p, p) - 0.85;
        p = rot(u_time * 0.03 * (fi + 1.0)) * p;
    }

    float hue = u_time * 0.05 + u_energy * 0.3 + u_beat_phase * 0.1;
    float sat = 0.6 + u_stereo * 0.4;
    float val = length(p) * 0.25 + u_energy * 0.4;
    col += hsv2rgb(vec3(hue, sat, val)) * 0.7;

    // Beat Puls
    float radius = 0.15 + (1.0 - u_beat_phase) * 0.08 + u_bass * 0.05;
    float dist   = length(uvc);
    float ring   = smoothstep(radius + 0.01, radius, dist)
                 * smoothstep(radius - 0.025, radius, dist);
    float bn     = clamp((u_bpm - 60.0) / 120.0, 0.0, 1.0);
    col += mix(vec3(0.3, 0.5, 1.0), vec3(1.0, 0.3, 0.3), bn)
         * ring * (1.5 + u_beat_onset * 3.0);

    // Energie Aura
    col += hsv2rgb(vec3(hue + 0.15, 0.8, 1.0))
         * exp(-dist * 2.5) * u_energy * 0.5;

    // Vignette
    col *= 1.0 - dot(uvc * 0.35, uvc * 0.35);
    col += u_beat_onset * 0.06;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
