#pragma once
#include <cstdint>
#include "../Types.h"

struct FeedbackState {
    float zoom;
    float rotation;
    float warp_x;
    float warp_y;
    float dx;
    float dy;
    float decay;
    float brightness;
    float contrast;
    float time;
    float beat_phase;
    float bass;
    float mid;
    float high;
    float energy;
};

class FeedbackRenderer {
public:
    FeedbackRenderer();
    void update(const ShaderDNA& dna, const AudioData& audio, float delta_time);
    const FeedbackState& state() const { return state_; }

private:
    FeedbackState state_{};
    float         time_          = 0.0f;
    float         smooth_zoom_     = 1.0f;
    float         smooth_rotation_ = 0.0f;
    float         smooth_warp_x_   = 0.0f;
    float         smooth_warp_y_   = 0.0f;
};
