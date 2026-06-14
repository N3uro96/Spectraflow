#include "spectraflow_ffi.h"
#include "audio/AudioEngine.h"
#include "render/DNASystem.h"
#include "Types.h"
#include <memory>
#include <cstring>

// ─────────────────────────────────────────
// Globale Engine Instanzen
// ─────────────────────────────────────────
static std::unique_ptr<AudioEngine> g_audio;
static std::unique_ptr<DNASystem>   g_dna;

// ─────────────────────────────────────────
// Hilfsfunktionen für Struct Konvertierung
// ─────────────────────────────────────────
static void audio_to_ffi(const AudioData& src, SF_AudioData& dst)
{
    std::memcpy(dst.fft_left,   src.fft_left,   sizeof(float) * 32);
    std::memcpy(dst.fft_right,  src.fft_right,  sizeof(float) * 32);
    std::memcpy(dst.fft_mid,    src.fft_mid,    sizeof(float) * 32);
    std::memcpy(dst.fft_side,   src.fft_side,   sizeof(float) * 32);
    std::memcpy(dst.env_left,   src.env_left,   sizeof(float) * 32);
    std::memcpy(dst.env_right,  src.env_right,  sizeof(float) * 32);

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

// ─────────────────────────────────────────
// Engine Lifecycle
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// Audio
// ─────────────────────────────────────────
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

void sf_set_sample_rate(float sample_rate)
{
    if (g_audio) g_audio->set_sample_rate(sample_rate);
}

void sf_set_attack(float ms)
{
    if (g_audio) g_audio->set_attack(ms);
}

void sf_set_release(float ms)
{
    if (g_audio) g_audio->set_release(ms);
}

float sf_get_bpm()          { return g_audio ? g_audio->get_bpm()          : 0.0f; }
float sf_get_energy()       { return g_audio ? g_audio->get_energy()       : 0.0f; }
float sf_get_stereo_width() { return g_audio ? g_audio->get_stereo_width() : 0.0f; }

// ─────────────────────────────────────────
// DNA System
// ─────────────────────────────────────────
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

uint64_t
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
    spectraflow_ffi.cpp
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
