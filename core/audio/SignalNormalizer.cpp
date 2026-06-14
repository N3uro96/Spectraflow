#include "SignalNormalizer.h"
#include <cmath>
#include <numeric>
#include <algorithm>

SignalNormalizer::SignalNormalizer()
{
    peak_left_.fill(0.0f);
    peak_right_.fill(0.0f);
    peak_mid_.fill(0.0f);
    peak_side_.fill(0.0f);
    rms_history_left_.fill(0.0f);
    rms_history_right_.fill(0.0f);
}

void SignalNormalizer::process(AudioData& data)
{
    // ─────────────────────────────────────────
    // 1. RMS berechnen (Durchschnittsenergie)
    // ─────────────────────────────────────────
    float rms_left  = 0.0f;
    float rms_right = 0.0f;

    for (size_t i = 0; i < 32; i++) {
        rms_left  += data.fft_left[i]  * data.fft_left[i];
        rms_right += data.fft_right[i] * data.fft_right[i];
    }
    rms_left  = std::sqrt(rms_left  / 32.0f);
    rms_right = std::sqrt(rms_right / 32.0f);

    // RMS in Historie speichern
    rms_history_left_[rms_index_]  = rms_left;
    rms_history_right_[rms_index_] = rms_right;
    rms_index_ = (rms_index_ + 1) % RMS_HISTORY;

    // Durchschnittlicher RMS über ~1 Sekunde
    float avg_rms_left  = std::accumulate(rms_history_left_.begin(),
                                           rms_history_left_.end(), 0.0f)
                          / RMS_HISTORY;
    float avg_rms_right = std::accumulate(rms_history_right_.begin(),
                                           rms_history_right_.end(), 0.0f)
                          / RMS_HISTORY;

    // ─────────────────────────────────────────
    // 2. Auto-Gain berechnen
    // ─────────────────────────────────────────
    if (avg_rms_left > 1e-6f)
        gain_left_  = std::clamp(target_rms_ / avg_rms_left,
                                  0.1f, max_gain_);
    if (avg_rms_right > 1e-6f)
        gain_right_ = std::clamp(target_rms_ / avg_rms_right,
                                  0.1f, max_gain_);

    // ─────────────────────────────────────────
    // 3. Gain anwenden + Peak Limiter pro Band
    // ─────────────────────────────────────────
    update_gain(data.fft_left,  peak_left_,  &gain_left_,  32);
    update_gain(data.fft_right, peak_right_, &gain_right_, 32);

    // Envelopes ebenfalls normalisieren
    update_gain(data.env_left,  peak_left_,  &gain_left_,  32);
    update_gain(data.env_right, peak_right_, &gain_right_, 32);

    // Mid/Side neu berechnen nach Normalisierung
    for (size_t i = 0; i < 32; i++) {
        data.fft_mid[i]  = (data.fft_left[i] + data.fft_right[i]) * 0.5f;
        data.fft_side[i] = std::abs(data.fft_left[i] - data.fft_right[i]) * 0.5f;
    }

    // ─────────────────────────────────────────
    // 4. Stereo Breite neu berechnen
    // ─────────────────────────────────────────
    float side_energy = 0.0f;
    float mid_energy  = 0.0f;
    for (size_t i = 0; i < 32; i++) {
        side_energy += data.fft_side[i];
        mid_energy  += data.fft_mid[i];
    }
    data.stereo_width = (mid_energy > 1e-6f)
        ? std::min(1.0f, side_energy / mid_energy)
        : 0.0f;

    // ─────────────────────────────────────────
    // 5. Energie-Bänder neu berechnen
    // ─────────────────────────────────────────
    data.bass_left  = 0.0f; data.bass_right  = 0.0f;
    data.mid_left   = 0.0f; data.mid_right   = 0.0f;
    data.high_left  = 0.0f; data.high_right  = 0.0f;

    for (int i = 0; i < 8;  i++) {
        data.bass_left  += data.env_left[i];
        data.bass_right += data.env_right[i];
    }
    for (int i = 8; i < 20; i++) {
        data.mid_left   += data.env_left[i];
        data.mid_right  += data.env_right[i];
    }
    for (int i = 20; i < 32; i++) {
        data.high_left  += data.env_left[i];
        data.high_right += data.env_right[i];
    }

    data.bass_left  /= 8.0f;  data.bass_right  /= 8.0f;
    data.mid_left   /= 12.0f; data.mid_right   /= 12.0f;
    data.high_left  /= 12.0f;

cat > /workspaces/Spectraflow/core/CMakeLists.txt << 'EOF'
cmake_minimum_required(VERSION 3.28)
project(SpectraflowCore VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# kissfft
add_library(kissfft STATIC
    kissfft/kiss_fft.c
)
target_include_directories(kissfft PUBLIC kissfft)

# Core Sources
set(CORE_SOURCES
    audio/AudioEngine.cpp
    audio/FFTAnalyzer.cpp
    audio/BPMDetector.cpp
    audio/SignalNormalizer.cpp
    render/DNASystem.cpp
    ai/AIBrain.cpp
)

# Shared Library für Flutter FFI
add_library(spectraflow_core SHARED ${CORE_SOURCES})

target_include_directories(spectraflow_core PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
)

target_link_libraries(spectraflow_core PRIVATE kissfft)

# Platform spezifisch
if(ANDROID)
    target_link_libraries(spectraflow_core PRIVATE log android)
elseif(APPLE)
    target_link_libraries(spectraflow_core PRIVATE "-framework AudioToolbox")
elseif(WIN32)
    target_link_libraries(spectraflow_core PRIVATE winmm)
endif()
