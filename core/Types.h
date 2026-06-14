#pragma once
#include <cstdint>
#include <array>

struct AudioData {
    std::array<float, 32> fft_left   {};
    std::array<float, 32> fft_right  {};
    std::array<float, 32> fft_mid    {};
    std::array<float, 32> fft_side   {};
    std::array<float, 32> env_left   {};
    std::array<float, 32> env_right  {};

    float stereo_width = 0.0f;
    float pan_center   = 0.0f;
    float bpm          = 120.0f;
    bool  beat_onset   = false;
    float beat_phase   = 0.0f;
    float bass_left    = 0.0f;
    float bass_right   = 0.0f;
    float mid_left     = 0.0f;
    float mid_right    = 0.0f;
    float high_left    = 0.0f;
    float high_right   = 0.0f;
    float energy       = 0.0f;
    uint64_t timestamp_ms = 0;
};

struct ShaderDNA {
    uint64_t seed     = 0;
    float    zoom     = 1.0f;
    float    rotation = 0.0f;
    float    warp_x   = 0.0f;
    float    warp_y   = 0.0f;
    float    dx       = 0.0f;
    float    dy       = 0.0f;
    float    params[16] {};
};

struct RenderParams {
    int       shader_id       = 0;
    int       shader_id_next  = 0;
    float     transition_alpha = 0.0f;
    ShaderDNA dna;
    int       palette_id      = 0;
    int       camera_preset   = 0;
    int       camera_preset_b = 0;
    bool      dual_mesh_active = false;
    float     global_fx_amount = 0.0f;
};

struct AIResult {
    int      shader_id     = 0;
    uint64_t seed          = 0;
    int      palette_id    = 0;
    int      camera_preset = 0;
    float    confidence    = 0.0f;
};

struct Session {
    char     name[64]       {};
    int      shader_id      = 0;
    uint64_t seed           = 0;
    int      palette_id     = 0;
    int      camera_preset  = 0;
    bool     dual_mesh_active = false;
    int      camera_preset_b = 0;
    float    global_fx_amount = 0.0f;
};
