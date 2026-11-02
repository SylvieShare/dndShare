#include <jni.h>
#include <algorithm>
#include <cstdint>
#include <mutex>
#include <vector>
#include "basis/basisu_transcoder.h"

// All buffers are owned by the call. Only immutable decoder tables are shared.
extern "C" JNIEXPORT jbyteArray JNICALL
Java_ru_dndshare_client_maps_geometry_MapTextureCodec_decodeKtx2(JNIEnv* env, jobject,
        jbyteArray source, jint maximum) {
    if (!source || maximum < 1 || maximum > 4096) return nullptr;
    static std::once_flag tables;
    std::call_once(tables, [] { basist::basisu_transcoder_init(); });
    const jsize size = env->GetArrayLength(source);
    if (size < 80 || size > 128 * 1024 * 1024) return nullptr;
    std::vector<uint8_t> input(size);
    env->GetByteArrayRegion(source, 0, size, reinterpret_cast<jbyte*>(input.data()));
    basist::ktx2_transcoder decoder;
    if (!decoder.init(input.data(), size)) {
        env->ThrowNew(env->FindClass("java/lang/IllegalArgumentException"), "Unsupported KTX2/Basis header"); return nullptr;
    }
    if (!decoder.start_transcoding()) {
        env->ThrowNew(env->FindClass("java/lang/IllegalArgumentException"), "Corrupt KTX2/Basis payload"); return nullptr;
    }
    uint32_t level = 0;
    while (level + 1 < decoder.get_levels() &&
            std::max(decoder.get_width() >> level, decoder.get_height() >> level) >
            static_cast<uint32_t>(maximum)) ++level;
    const uint32_t width = std::max(1u, decoder.get_width() >> level);
    const uint32_t height = std::max(1u, decoder.get_height() >> level);
    if (width > 4096 || height > 4096) return nullptr;
    const uint32_t pixels = width * height;
    std::vector<uint8_t> output(8 + pixels * 4);
    for (unsigned i = 0; i < 4; ++i) {
        output[i] = width >> (i * 8);
        output[4 + i] = height >> (i * 8);
    }
    if (!decoder.transcode_image_level(level, 0, 0, output.data() + 8, pixels,
            basist::transcoder_texture_format::cTFRGBA32)) return nullptr;
    auto result = env->NewByteArray(static_cast<jsize>(output.size()));
    if (result) env->SetByteArrayRegion(result, 0, output.size(),
            reinterpret_cast<const jbyte*>(output.data()));
    return result;
}
