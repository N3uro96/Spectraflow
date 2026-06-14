#include "BPMDetector.h"
#include <cmath>
#include <numeric>
#include <algorithm>

BPMDetector::BPMDetector()
{
    energy_history_.fill(0.0f);
    beat_times_.fill(0.0f);
    frame_time_ = 1024.0f / sample_rate_; // Zeit pro Frame
}

void BPMDetector::process(const AudioData& audio, float& bpm_out,
                           bool& beat_onset_out, float& beat_phase_out)
{
    // Gesamtenergie Bass + Mid (Bass-Beats dominieren BPM)
    float energy = (audio.bass_left + audio.bass_right) * 0.7f
                 + (audio.mid_left  + audio.mid_right)  * 0.3f;

    // Zeit vorwärts
    elapsed_time_ += frame_time_;

    // Onset Detection
    detect_onset(energy);

    // BPM updaten
    update_bpm();

    // Beat Phase (0.0 - 1.0 Fortschritt im aktuellen Beat)
    if (current_bpm_ > 0.0f) {
        float beat_duration = 60.0f / current_bpm_;
        float time_since    = elapsed_time_ - last_beat_;
        beat_phase_         = std::fmod(time_since / beat_duration, 1.0f);
    }

    bpm_out        = current_bpm_;
    beat_onset_out = (elapsed_time_ - last_beat_) < frame_time_ * 2.0f;
    beat_phase_out = beat_phase_;
}

void BPMDetector::detect_onset(float energy)
{
    // Durchschnitt der Energie-Historie berechnen
    float avg = std::accumulate(energy_history_.begin(),
                                energy_history_.end(), 0.0f)
                / HISTORY_SIZE;

    // Energie in Historie speichern
    energy_history_[history_index_] = energy;
    history_index_ = (history_index_ + 1) % HISTORY_SIZE;

    // Beat erkannt wenn Energie deutlich über Durchschnitt
    float time_since_last = elapsed_time_ - last_beat_;
    if (energy > avg * threshold_ && time_since_last > min_beat_gap_) {
        last_beat_ = elapsed_time_;

        // Beat-Zeit speichern
        beat_times_[beat_count_ % MAX_BEATS] = elapsed_time_;
        beat_count_++;
    }
}

void BPMDetector::update_bpm()
{
    // Mindestens 4 Beats für stabile BPM-Schätzung
    if (beat_count_ < 4) return;

    size_t count = std::min(beat_count_, MAX_BEATS);
    float  total = 0.0f;
    size_t pairs = 0;

    // Durchschnittliches Intervall zwischen aufeinanderfolgenden Beats
    for (size_t i = 1; i < count; i++) {
        float interval = beat_times_[i % MAX_BEATS]
                       - beat_times_[(i - 1) % MAX_BEATS];
        if (interval > 0.1f && interval < 2.0f) {
            total += interval;
            pairs++;
        }
    }

    if (pairs > 0) {
        float avg_interval = total / pairs;
        float new_bpm      = 60.0f / avg_interval;

        // BPM Bereich: 60-200 BPM
        if (new_bpm >= 60.0f && new_bpm <= 200.0f) {
            // Sanftes Smoothing damit BPM nicht springt
            current_bpm_ = current_bpm_ * 0.8f + new_bpm * 0.2f;
        }
    }
}
