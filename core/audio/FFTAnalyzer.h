#pragma once
#include <cstddef>
#include <array>
#include <vector>
#include "../Types.h"
#include "kiss_fft.h"

class FFTAnalyzer {
public:
    static constexpr size_t FFT_SIZE  = 2048;
    static constexpr size_t NUM_BANDS = 32;

    FFTAnalyzer();
    ~FFTAnalyzer();

    void process(const float* left, const float* right,
                 size_t num_samples, AudioData& out);
    void set_attack(float ms)      { attack_ms_   = ms; }
    void set_release(float ms)     { release_ms_  = ms; }
    void set_sample_rate(float sr) { sample_rate_ = sr; build_log_bands(); }

private:
    void compute_fft(const float* samples, float* bands_out);
    void compute_mid_side(AudioData& data);
    void apply_envelope(float* envelope, const float* bands,
                        float attack_ms, float release_ms);
    void build_log_bands();

    kiss_fft_cfg                     cfg_;
    std::array<float, FFT_SIZE>      hanning_window_;
    std::array<int,   NUM_BANDS + 1> band_limits_;
    float attack_ms_   =   5.0f;
    float release_ms_  = 150.0f;
    float sample_rate_ = 44100.0f;

    std::array<float, NUM_BANDS> prev_env_left_;
    std::array<float, NUM_BANDS> prev_env_right_;

    // Vorab reservierter Speicher für den Audio-Thread
    std::vector<kiss_fft_cpx> in_buf_;
    std::vector<kiss_fft_cpx> out_buf_;
};