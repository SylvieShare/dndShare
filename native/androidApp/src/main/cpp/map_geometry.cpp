#include <jni.h>
#include <cstdint>
#include <vector>
#include "meshoptimizer/meshoptimizer.h"

static void invalid(JNIEnv* env, const char* message) {
    env->ThrowNew(env->FindClass("java/lang/IllegalArgumentException"), message);
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_ru_dndshare_client_maps_geometry_Meshopt_decode(JNIEnv* env, jobject,
        jbyteArray source, jint count, jint stride, jint mode, jint filter) {
    if (!source || count <= 0 || stride <= 0 || stride > 256 ||
            static_cast<uint64_t>(count) * stride > 128ULL * 1024 * 1024) {
        invalid(env, "Invalid mesh buffer dimensions"); return nullptr;
    }
    if ((mode == 0 && stride % 4) || (mode != 0 && stride != 2 && stride != 4) ||
            (mode == 1 && count % 3) || mode < 0 || mode > 2 || filter < 0 || filter > 4 ||
            (filter && mode != 0) || (filter == 1 && stride != 4 && stride != 8) ||
            (filter == 2 && stride != 8) || (filter == 3 && stride % 4) ||
            (filter == 4 && stride != 4 && stride != 8)) {
        invalid(env, "Invalid mesh codec parameters"); return nullptr;
    }
    const jsize length = env->GetArrayLength(source);
    std::vector<unsigned char> compressed(length);
    env->GetByteArrayRegion(source, 0, length, reinterpret_cast<jbyte*>(compressed.data()));
    std::vector<unsigned char> output(static_cast<size_t>(count) * stride);
    int status = mode == 0 ? meshopt_decodeVertexBuffer(output.data(), count, stride, compressed.data(), length)
        : mode == 1 ? meshopt_decodeIndexBuffer(output.data(), count, stride, compressed.data(), length)
        : meshopt_decodeIndexSequence(output.data(), count, stride, compressed.data(), length);
    if (status != 0) { invalid(env, "Corrupt compressed mesh buffer"); return nullptr; }
    switch (filter) {
        case 1: meshopt_decodeFilterOct(output.data(), count, stride); break;
        case 2: meshopt_decodeFilterQuat(output.data(), count, stride); break;
        case 3: meshopt_decodeFilterExp(output.data(), count, stride); break;
        case 4: meshopt_decodeFilterColor(output.data(), count, stride); break;
    }
    auto result = env->NewByteArray(static_cast<jsize>(output.size()));
    if (result) env->SetByteArrayRegion(result, 0, output.size(), reinterpret_cast<const jbyte*>(output.data()));
    return result;
}
