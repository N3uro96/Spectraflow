#include "spectraflow_ffi.h"
#include "audio/AudioEngine.h"
#include "render/DNASystem.h"
#include "Types.h"
#include <memory>
#include <cstring>

static std::unique_ptr<AudioEngine> g_audio;
static std::unique_ptr<DNASystem>   g_dna;

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

static SF_ShaderDNA dna_to_ffi(const ShaderDNA& src)
{
    SF_ShaderDNA dst{};
    dst.seed     = src.seed;
    dst.zoom     = src.zoom;
    dst.rotation = src.rotation;
    dst.warp_x   = src.warp_x;
    dst.warp_y   = src.warp_y;
    dst.dx       = src.dx;
    dst.dy       = src.dy;
    std::memcpy(dst.params, src.params, sizeof(float) * 16);
    return dst;
}

static ShaderDNA ffi_to_dna(const SF_ShaderDNA& src)
{
    ShaderDNA dst{};
    dst.seed     = src.seed;
    dst.zoom     = src.zoom;
    dst.rotation = src.rotation;
    dst.warp_x   = src.warp_x;
    dst.warp_y   = src.warp_y;
    dst.dx       = src.dx;
    dst.dy       = src.dy;
    std::memcpy(dst.params, src.params, sizeof(float) * 16);
    return dst;
}

#ifdef __cplusplus
extern "C" {
#endif

bool sf_init()
{
    g_audio = std::make_unique<AudioEngine>();
    g_dna   = std::make_unique<DNASystem>();
    return g_audio->start();
}

void sf_shutdown()
{
    if (g_audio) g_audio->stop();
    g_audio.reset();
    g_dna.reset();
}

void sf_feed_audio(const float* left, const float* right, int num_samples)
{
    if (g_audio)
        g_audio->feed(left, right, static_cast<size_t>(num_samples));
}

bool sf_get_audio_data(SF_AudioData* out)
{
    if (!g_audio || !out) return false;
    AudioData data{};
    if (!g_audio->get_latest(data)) return false;
    audio_to_ffi(data, *out);
    return true;
}

void sf_set_sample_rate(float sr)     { if (g_audio) g_audio->set_sample_rate(sr); }
void sf_set_attack(float ms)          { if (g_audio) g_audio->set_attack(ms); }
void sf_set_release(float ms)         { if (g_audio) g_audio->set_release(ms); }
float sf_get_bpm()                    { return g_audio ? g_audio->get_bpm()          : 0.0f; }
float sf_get_energy()                 { return g_audio ? g_audio->get_energy()       : 0.0f; }
float sf_get_stereo_width()           { return g_audio ? g_audio->get_stereo_width() : 0.0f; }

SF_ShaderDNA sf_generate_dna(uint64_t seed, int shader_id)
{
    if (!g_dna) return SF_ShaderDNA{};
    return dna_to_ffi(g_dna->generate(seed, shader_id));
}

SF_ShaderDNA sf_morph_dna(SF_ShaderDNA a, SF_ShaderDNA b, float t)
{
    if (!g_dna) return SF_ShaderDNA{};
    return dna_to_ffi(g_dna->morph(ffi_to_dna(a), ffi_to_dna(b), t));
}

uint64_t sf_random_seed()
{
    if (!g_dna) return 0;
    return g_dna->random_seed();
}

#ifdef __cplusplus
}
#endif
