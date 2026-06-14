#pragma once
#include <array>
#include <cstddef>
#include "../Types.h"

class SignalNormalizer {
public:
    SignalNormalizer();

    // Normalisiert alle Bänder in AudioData in-place
    void process(AudioData& data);

    // Einstellungen
    void set_target_rms(float target) { target_rms_ = target; }
    void set_max_gain(float gain)     { max_gain_   = gain;   }

private:
    void update_gain(float* bands, float* peak_hold,
                     float* gain, size_t count);

    // Ziel-RMS Pegel (0.0 - 1.0)
    float target_rms_ = 0.3f;

    // Maximaler Gain (verhindert extremes Aufblasen bei Stille)
    float max_gain_   = 8.0f;

    // Per-Band Peak-Hold für linken und rechten Kanal
    std::array<float, 32> peak_left_;
    std::array<float, 32> peak_right_;
    std::array<float, 32> peak_mid_;
    std::array<float, 32> peak_side_;

    // Aktueller Gain pro Kanal
    float gain_left_  = 1.0f;
    float gain_right_ = 1.0f;

    // RMS Historie (~1 Sekunde)
    static constexpr size_t RMS_HISTORY = 43;
    std::array<float, RMS_HISTORY> rms_history_left_;
    std::array<float, RMS_HISTORY> rms_history_right_;
    size_t rms_index_ = 0;

    // Peak Limiter Koeffizienten
    float peak_attack_  = 0.99f;  // Sofort auf Peak reagieren
    float peak_release_ = 0.995f; // Langsam loslassen
};
