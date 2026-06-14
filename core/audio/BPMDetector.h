#pragma once
#include <array>
#include <cstddef>
#include "../Types.h"

class BPMDetector {
public:
    BPMDetector();
    
    // Signatur angepasst: num_samples hinzugefügt
    void process(const AudioData& audio, size_t num_samples, float& bpm_out,
                 bool& beat_onset_out, float& beat_phase_out);
                 
    void set_sample_rate(float sr) { sample_rate_ = sr; }

private:
    void detect_onset(float energy);
    void update_bpm();
    
    static constexpr size_t HISTORY_SIZE = 43;
    std::array<float, HISTORY_SIZE> energy_history_;
    size_t history_index_ = 0;

    static constexpr size_t MAX_BEATS = 16;
    std::array<float, MAX_BEATS> beat_times_;
    size_t beat_count_  = 0;
    float  last_beat_   = 0.0f;
    float  current_bpm_ = 120.0f;
    float  beat_phase_  = 0.0f;
    
    float  threshold_    = 1.8f;
    float  min_beat_gap_ = 0.3f;
    float  sample_rate_  = 44100.0f;
    float  elapsed_time_ = 0.0f;
    float  frame_time_   = 0.0f;
};