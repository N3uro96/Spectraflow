#include "FeedbackRenderer.h"
#include <cmath>
#include <algorithm>

FeedbackRenderer::FeedbackRenderer() {}

void FeedbackRenderer::update(const ShaderDNA& dna,
                               const AudioData& audio,
                               float delta_time)
{
    time_ += delta_time;

    float bass   = (audio.bass_left + audio.bass_right) * 0.5f;
    float mid    = (audio.mid_left  + audio.mid_right)  * 0.5f;
    float high   = (audio.high_left + audio.high_right) * 0.5f;
    float energy = audio.energy;

    // ── Ziel-Werte aus DNA + Audio ──
    // DNA gibt den Charakter, Audio gibt die Reaktivität

    // Zoom: leicht rein zoomen + Bass Puls
    float target_zoom = dna.zoom
        + bass  * dna.params[11] * 0.05f
        + (audio.beat_onset ? 0.02f : 0.0f);
    target_zoom = std::clamp(target_zoom, 0.95f, 1.05f);

    // Rotation: DNA Geschwindigkeit + Mid Modulation
    float target_rot = dna.rotation * delta_time * 0.5f
        + mid * dna.params[12] * 0.01f;

    // Warp: DNA Basis + High Frequenz Zittern
    float target_warp_x = dna.warp_x
        + std::sin(time_ * dna.params[7] + high) * dna.params[2] * 0.1f;
    float target_warp_y = dna.warp_y
        + std::cos(time_ * dna.params[7] + high) * dna.params[3] * 0.1f;

    // ── Smooth Interpolation (kein hartes Springen) ──
    const float smooth = 0.15f;
    smooth_zoom_     = smooth_zoom_     + smooth * (target_zoom     - smooth_zoom_);
    smooth_rotation_ = smooth_rotation_ + smooth * (target_rot      - smooth_rotation_);
    smooth_warp_x_   = smooth_warp_x_   + smooth * (target_warp_x   - smooth_warp_x_);
    smooth_warp_y_   = smooth_warp_y_   + smooth * (target_warp_y   - smooth_warp_y_);

    // ── Decay: wie stark altes Bild verblasst ──
    // Hohe Energie = mehr Decay (Bild erneuert sich schneller)
    float target_decay = dna.params[8] * 0.04f + 0.95f
        - energy * 0.02f;
    target_decay = std::clamp(target_decay, 0.92f, 0.99f);

    // ── State befüllen ──
    state_.zoom       = smooth_zoom_;
    state_.rotation   = smooth_rotation_;
    state_.warp_x     = smooth_warp_x_;
    state_.warp_y     = smooth_warp_y_;
    state_.dx         = dna.dx * 0.01f;
    state_.dy         = dna.dy * 0.01f;
    state_.decay      = target_decay;
    state_.brightness = 0.8f + energy * 0.2f;
    state_.contrast   = 1.0f + mid * 0.3f;
    state_.time       = time_;
    state_.beat_phase = audio.beat_phase;
    state_.bass       = bass;
    state_.mid        = mid;
    state_.high       = high;
    state_.energy     = energy;
}
