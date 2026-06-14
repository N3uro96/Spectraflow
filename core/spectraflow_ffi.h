#pragma once
#include <cstdint>
#include <cstdbool>

// ─────────────────────────────────────────
// Spectraflow FFI API
// Diese Funktionen sind von Flutter aus aufrufbar
// Alle Funktionen sind extern "C" für sauberes Symbol-Exporting
// ─────────────────────────────────────────

#ifdef __cplusplus
extern "C" {
#endif

// Flaches Struct für FFI (kein C++ spezifisches)
typedef struct {
    // FFT Bänder
    float fft_left[32];
    float fft_right[32];
    float fft_mid[32];
    float fft_side[32];

    // Envelopes
    float env_left[32];
    float env_right[32];

    // Stereo
    float stereo_width;
    float pan_center;

    // Beat
    float bpm;
    bool  beat_onset;
    float beat_phase;

    // Energie
    float bass_left;
    float bass_right;
    float mid_left;
    float mid_right;
    float high_left;
    float high_right;
    float energy;

    // Timestamp
    uint64_t timestamp_ms;
} SF_AudioData;

typedef struct {
    uint64_t seed;
    float    zoom;
    float    rotation;
    float    warp_x;
    float    warp_y;
    float    dx;
    float    dy;
    float    params[16];
} SF_ShaderDNA;

// ─────────────────────────────────────────
// Engine Lifecycle
// ─────────────────────────────────────────
bool sf_init();
void sf_shutdown();

// ─────────────────────────────────────────
// Audio
// ─────────────────────────────────────────
void sf_feed_audio(const float* left, const float* right,
                   int num_samples);
bool sf_get_audio_data(SF_AudioData* out);
void sf_set_sample_rate(float sample_rate);
void sf_set_attack(float ms);
void sf_set_release(float ms);

// Status
float sf_get_bpm();
float sf_get_energy();
float sf_get_stereo_width();

// ─────────────────────────────────────────
// DNA System
// ─────────────────────────────────────────
SF_ShaderDNA sf_generate_dna(uint64_t seed, int shader_id);
SF_ShaderDNA sf_morph_dna(SF_ShaderDNA a, SF_ShaderDNA b, float t);
uint64_t     sf_random_seed();

#ifdef __cplusplus
}
#endif
