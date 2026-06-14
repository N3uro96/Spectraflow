#pragma once
#include <cstddef>
#include <array>
#include "../Types.h"

class FFTAnalyzer {
public:
    FFTAnalyzer();
    ~FFTAnalyzer();

    // Stereo Input → AudioData Output
    void process(const float* left, const float* right, size_t num_samples, AudioData& out);

private:
    void compute_fft(const float* samples, size_t num_samples, float* bands_out);
    void compute_mid_side(AudioData& data);
    void apply_adsr(float* envelope, const float* bands, size_t count);

    // ADSR Einstellungen
    float attack_;   // ms
    float decay_;    // ms
    float release_;  // ms

    // Vorherige Envelopes für Glättung
    std::array<float, 32> prev_env_left_;
    std::array<float, 32> prev_env_right_;
};
