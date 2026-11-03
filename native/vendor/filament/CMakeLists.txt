cmake_minimum_required(VERSION 3.19)
project(dndshare_filament_ortho LANGUAGES C CXX)

# Keep the official SDK, JNI implementation and exported ABI. Only Froxelizer.cpp
# is rebuilt; the linker then leaves its original archive member unselected.
set(FILAMENT_SUPPORTS_VULKAN ON CACHE BOOL "" FORCE)
add_subdirectory("${FILAMENT_SOURCE_DIR}/android/filament-android" upstream)
target_sources(filament-jni PRIVATE "${FILAMENT_PATCHED_FROXELIZER}")
file(GLOB FILAMENT_PRIVATE_INCLUDES "${FILAMENT_SOURCE_DIR}/libs/*/include")
target_include_directories(filament-jni PRIVATE
    "${FILAMENT_SOURCE_DIR}/filament/src"
    "${FILAMENT_SOURCE_DIR}/filament/backend/include"
    ${FILAMENT_PRIVATE_INCLUDES})
target_compile_definitions(filament-jni PRIVATE
    FILAMENT_TARGET_MOBILE=1 FILAMENT_ENABLE_MATDBG=0 FILAMENT_ENABLE_FGVIEWER=0)
# The SDK enables exceptions. Disabling them changes FEngine's private layout.
target_compile_options(filament-jni PRIVATE -fno-rtti -fexceptions
    "-ffile-prefix-map=${FILAMENT_SOURCE_DIR}=/filament"
    "-ffile-prefix-map=${FILAMENT_PATCHED_FROXELIZER}=/filament/filament/src/Froxelizer.cpp")
