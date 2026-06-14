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
