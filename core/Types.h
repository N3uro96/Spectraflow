#pragma once
#include <cstdint>

// ─────────────────────────────────────────
//  Stereo Audio Data (Audio Thread → Render Thread)
// ─────────────────────────────────────────
struct AudioData {
    // FFT pro Kanal
    float fft_left[32];
    float fft_right[32];

    // Mid/Side
    float fft_mid[32];
    float fft_side[32];

    // ADSR Envelopes
    float env_left[32];
    float env_right[32];

    // Stereo Bild
    float stereo_width;
    float pan_center;

    // Beat
    float bpm;
    bool  beat_onset;
    float beat_phase;     // 0.0 - 1.0 Position im Beat

    // Energie
    float bass_left,  bass_right;
    float mid_left,   mid_right;
    float high_left,  high_right;
    float energy;

    // Timestamp
    uint64_t timestamp_ms;
};

// ─────────────────────────────────────────
//  Shader DNA (prozedural aus Seed generiert)
// ─────────────────────────────────────────
struct ShaderDNA {
    uint64_t seed;
    float    zoom;
    float    rotation;
    float    warp_x;
    float    warp_y;
    float    dx;
    float    dy;
    float    params[16];   // Shader-spezifische Parameter
};

// ─────────────────────────────────────────
//  Render Parameter (pro Frame)
// ─────────────────────────────────────────
struct RenderParams {
    int       shader_id;
    int       shader_id_next;
    float     transition_alpha;
    ShaderDNA dna;
    int       palette_id;
    int       camera_preset;
    int       camera_preset_b;
    bool      dual_mesh_active;
    float     global_fx_amount;
};

// ─────────────────────────────────────────
//  KI Ergebnis
// ─────────────────────────────────────────
struct AIResult {
    int      shader_id;
    uint64_t seed;
    int      palette_id;
    int      camera_preset;
    float    confidence;
};

// ─────────────────────────────────────────
//  User Session / Preset
// ─────────────────────────────────────────
struct Session {
    char     name[64];
    int      shader_id;
    uint64_t seed;
    int      palette_id;
    int      camera_preset;
    bool     dual_mesh_active;
    int      camera_preset_b;
    float    global_fx_amount;
};
