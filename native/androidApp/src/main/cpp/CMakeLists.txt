cmake_minimum_required(VERSION 3.22)
project(dndshare_geometry LANGUAGES C CXX)
add_library(dndshare_geometry SHARED map_geometry.cpp
    map_textures.cpp basis/basisu_transcoder.cpp zstd/zstddeclib.c
    meshoptimizer/vertexcodec.cpp meshoptimizer/indexcodec.cpp meshoptimizer/vertexfilter.cpp)
target_compile_features(dndshare_geometry PRIVATE cxx_std_17)
# The vendored transcoder is optimized in debug APKs too. Its assertion-only
# hash-table diagnostics assume uint64_t == unsigned long long on LP64 targets.
target_compile_definitions(dndshare_geometry PRIVATE BASISD_SUPPORT_KTX2_ZSTD=1 NDEBUG)
target_compile_options(dndshare_geometry PRIVATE -O2 -fvisibility=hidden)
target_link_options(dndshare_geometry PRIVATE "-Wl,-z,max-page-size=16384")
