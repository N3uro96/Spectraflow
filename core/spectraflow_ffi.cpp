#include "spectraflow_ffi.h"
#include "audio/AudioEngine.h"
#include "render/DNASystem.h"
#include "render/FeedbackRenderer.h"
#include "Types.h"
#include <memory>
#include <cstring>
#include <cstdint>

static std::unique_ptr<AudioEngine>      g_audio;
static std::unique_ptr<DNASystem>        g_dna;
static std::unique_ptr<FeedbackRenderer> g_feedback;

static int       g_shader_id = 0;
static uint64_t  g_seed      = 0;
static ShaderDNA g_current_dna{};

static void audio_to_ffi(const AudioData& src, SF_AudioData& dst)
{
    std::memcpy(dst.fft_left,   src.fft_left.data(),   sizeof(float) * 32);
    std::memcpy(dst.fft_right,  src.fft_right.data(),  sizeof(float) * 32);
    std::memcpy(dst.fft_mid,    src.fft_mid.data(),    sizeof(float) * 32);
    std::memcpy(dst.fft_side,   src.fft_side.data(),   sizeof(float) * 32);
    std::memcpy(dst.env_left,   src.env_left.data(),   sizeof(float) * 32);
    std::memcpy(dst.env_right,  src.env_right.data(),  sizeof(float) * 32);
    dst.stereo_width = src.stereo_width;
    dst.pan_center   = src.pan_center;
    dst.bpm          = src.bpm;
    dst.beat_onset   = src.beat_onset;
    dst.beat_phase   = src.beat_phase;
    dst.bass_left    = src.bass_left;
    dst.bass_right   = src.bass_right;
    dst.mid_left     = src.mid_left;
    dst.mid_right    = src.mid_right;
    dst.high_left    = src.high_left;
    dst.high_right   = src.high_right;
    dst.energy       = src.energy;
    dst.timestamp_ms = src.timestamp_ms;
}

#ifdef __cplusplus
extern "C" {
#endif

bool sf_init()
{
    g_audio    = std::make_unique<AudioEngine>();
    g_dna      = std::make_unique<DNASystem>();
    g_feedback = std::make_unique<FeedbackRenderer>();
    g_seed     = g_dna->random_seed();
    g_current_dna = g_dna->generate(g_seed, g_shader_id);
    return g_audio->start();
}

void sf_shutdown()
{
    if (g_audio) g_audio->stop();
    g_audio.reset();
    g_dna.reset();
    g_feedback.reset();
}

void sf_feed_audio(const float* left, const float* right, int num_samples)
{ if (g_audio) g_audio->feed(left, right, static_cast<size_t>(num_samples)); }

bool sf_get_audio_data(SF_AudioData* out)
{
    if (!g_audio || !out) return false;
    AudioData data{};
    if (!g_audio->get_latest(data)) return false;
    audio_to_ffi(data, *out);
    return true;
}

void sf_set_sample_rate(float sr) { if (g_audio) g_audio->set_sample_rate(sr); }
void sf_set_attack(float ms)      { if (g_audio) g_audio->set_attack(ms); }
void sf_set_release(float ms)     { if (g_audio) g_audio->set_release(ms); }
float sf_get_bpm()          { return g_audio ? g_audio->get_bpm()          : 0.0f; }
float sf_get_energy()       { return g_audio ? g_audio->get_energy()       : 0.0f; }
float sf_get_stereo_width() { return g_audio ? g_audio->get_stereo_width() : 0.0f; }

// ─────────────────────────────────────────
// Feedback State
// ─────────────────────────────────────────
void sf_update_feedback(float delta_time)
{
    if (!g_feedback || !g_audio) return;
    AudioData audio{};
    g_audio->get_latest(audio);
    g_feedback->update(g_current_dna, audio, delta_time);
}

bool sf_get_feedback_state(SF_FeedbackState* out)
{
    if (!g_feedback || !out) return false;
    const FeedbackState& s = g_feedback->state();
    out->zoom       = s.zoom;
    out->rotation   = s.rotation;
    out->warp_x     = s.warp_x;
    out->warp_y     = s.warp_y;
    out->dx         = s.dx;
    out->dy         = s.dy;
    out->decay      = s.decay;
    out->brightness = s.brightness;
    out->contrast   = s.contrast;
    out->time       = s.time;
    out->beat_phase = s.beat_phase;
    out->bass       = s.bass;
    out->mid        = s.mid;
    out->high       = s.high;
    out->energy     = s.energy;
    return true;
}

void sf_set_shader(int shader_id, uint64_t seed)
{
    g_shader_id   = shader_id;
    g_seed        = seed;
    if (g_dna) g_current_dna = g_dna->generate(seed, shader_id);
}

SF_ShaderDNA sf_generate_dna(uint64_t seed, int shader_id)
{
    SF_ShaderDNA dst{};
    if (!g_dna) return dst;
    ShaderDNA src = g_dna->generate(seed, shader_id);
    dst.seed = src.seed; dst.zoom = src.zoom; dst.rotation = src.rotation;
    dst.warp_x = src.warp_x; dst.warp_y = src.warp_y;
    dst.dx = src.dx; dst.dy = src.dy;
    std::memcpy(dst.params, src.params, sizeof(float) * 16);
    return dst;
}

SF_ShaderDNA sf_morph_dna(SF_ShaderDNA a, SF_ShaderDNA b, float t)
{
    SF_ShaderDNA dst{};
    if (!g_dna) return dst;
    ShaderDNA sa{}, sb{};
    sa.seed = a.seed; sa.zoom = a.zoom; sa.rotation = a.rotation;
    sa.warp_x = a.warp_x; sa.warp_y = a.warp_y; sa.dx = a.dx; sa.dy = a.dy;
    std::memcpy(sa.params, a.params, sizeof(float) * 16);
    sb.seed = b.seed; sb.zoom = b.zoom; sb.rotation = b.rotation;
    sb.warp_x = b.warp_x; sb.warp_y = b.warp_y; sb.dx = b.dx; sb.dy = b.dy;
    std::memcpy(sb.params, b.params, sizeof(float) * 16);
    ShaderDNA result = g_dna->morph(sa, sb, t);
    dst.seed = result.seed; dst.zoom = result.zoom; dst.rotation = result.rotation;
    dst.warp_x = result.warp_x; dst.warp_y = result.warp_y;
    dst.dx = result.dx; dst.dy = result.dy;
    std::memcpy(dst.params, result.params, sizeof(float) * 16);
    return dst;
}

uint64_t sf_random_seed()
{ return g_dna ? g_dna->random_seed() : 0; }

#ifdef __cplusplus
}
#endif
