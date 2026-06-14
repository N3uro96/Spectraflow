cmake_minimum_required(VERSION 3.28)
project(spectraflow_core)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ─────────────────────────────────────────
# Oboe via FetchContent
# ─────────────────────────────────────────
include(FetchContent)
FetchContent_Declare(
    oboe
    GIT_REPOSITORY https://github.com/google/oboe.git
    GIT_TAG        main
    GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(oboe)

# ─────────────────────────────────────────
# Pfade – 3 Ebenen hoch zur Repo-Root
# ─────────────────────────────────────────
set(CORE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../../../core)

# ─────────────────────────────────────────
# kissfft
# ─────────────────────────────────────────
add_library(kissfft STATIC ${CORE_DIR}/kissfft/kiss_fft.c)
target_include_directories(kissfft PUBLIC ${CORE_DIR}/kissfft)

# ─────────────────────────────────────────
# Core Sources
# ─────────────────────────────────────────
add_library(spectraflow_core SHARED
    ${CORE_DIR}/audio/AudioEngine.cpp
    ${CORE_DIR}/audio/FFTAnalyzer.cpp
    ${CORE_DIR}/audio/BPMDetector.cpp
    ${CORE_DIR}/audio/SignalNormalizer.cpp
    ${CORE_DIR}/render/DNASystem.cpp
    ${CORE_DIR}/ai/AIBrain.cpp
    ${CORE_DIR}/spectraflow_ffi.cpp
    jni/SpectraflowJNI.cpp
)

target_include_directories(spectraflow_core PRIVATE
    ${CORE_DIR}
    ${oboe_SOURCE_DIR}/include
)

target_link_libraries(spectraflow_core
    kissfft
    oboe
    android
    log
)
