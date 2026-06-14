#include "BPMDetector.h"
#include <cmath>
#include <numeric>
#include <algorithm>

BPMDetector::BPMDetector()
{
    energy_history_.fill(0.0f);
    beat_times_.fill(0.0f);
    frame_time_ = 1024.0f / sample_rate_;
}

void BPMDetector::process(const AudioData& audio, float& bpm_out,
                           bool& beat_onset_out, float& beat_phase_out)
{
    // Nur Bass für BPM Detection
    float energy = (audio.bass_left + audio.bass_right) * 0.5f;

    elapsed_time_ += frame_time_;

    detect_onset(energy);
    update_bpm();

    // Beat Phase
    if (current_bpm_ > 0.0f) {
        float beat_duration  = 60.0f / current_bpm_;
        float time_since     = elapsed_time_ - last_beat_;
        beat_phase_          = std::fmod(time_since / beat_duration, 1.0f);
    }

    bpm_out        = current_bpm_;
    beat_onset_out = (elapsed_time_ - last_beat_) < frame_time_ * 2.0f;
    beat_phase_out = beat_phase_;
}

void BPMDetector::detect_onset(float energy)
{
    // Gleitender Durchschnitt
    float avg = std::accumulate(energy_history_.begin(),
                                energy_history_.end(), 0.0f) / HISTORY_SIZE;

    energy_history_[history_index_] = energy;
    history_index_ = (history_index_ + 1) % HISTORY_SIZE;

    float time_since_last = elapsed_time_ - last_beat_;

    // Strengere Bedingungen: Energie muss 1.8x über Durchschnitt
    // UND mindestens 0.3s seit letztem Beat
    // UND Mindestenergie von 0.05 (verhindert Stille-Beats)
    if (energy > avg * 1.8f
        && energy > 0.05f
        && time_since_last > min_beat_gap_)
    {
        last_beat_ = elapsed_time_;
        beat_times_[beat_count_ % MAX_BEATS] = elapsed_time_;
        beat_count_++;
    }
}

void BPMDetector::update_bpm()
{
    if (beat_count_ < 4) return;

    size_t count = std::min(beat_count_, MAX_BEATS);
    float  total = 0.0f;
    size_t pairs = 0;

    for (size_t i = 1; i < count; i++) {
        float interval = beat_times_[i % MAX_BEATS]
                       - beat_times_[(i - 1) % MAX_BEATS];
        // Nur plausible Intervalle (60-180 BPM)
        if (interval > 0.33f && interval < 1.0f) {
            total += interval;
            pairs++;
        }
    }

    if (pairs > 0) {
        float avg_interval = total / pairs;
        float new_bpm      = 60.0f / avg_interval;

        if (new_bpm >= 60.0f && new_bpm <= 180.0f) {
            // Starkes Smoothing: 95% alt, 5% neu
            // Verhindert Springen
            current_bpm_ = current_bpm_ * 0.95f + new_bpm * 0.05f;
        }
    }
}
