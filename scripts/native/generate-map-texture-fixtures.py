#!/usr/bin/env python3
"""Keep meshopt geometry and exercise KHR_texture_basisu through ordinary gltfio PBR."""

import copy
import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "frontend/tests/maps/fixtures/data"


def main():
    source = (ASSETS / "box-water.glb").read_bytes()
    size, _ = struct.unpack_from("<II", source, 12)
    document = json.loads(source[20:20 + size])
    binary_size, _ = struct.unpack_from("<II", source, 20 + size)
    binary = source[28 + size:28 + size + binary_size]
    for codec in ("basis-lz", "uastc"):
        data = copy.deepcopy(document)
        image = (ASSETS / f"checker-{codec}.ktx2").read_bytes()
        payload = binary + bytes((-len(binary)) % 4)
        view = data["bufferViews"][data["images"][0]["bufferView"]]
        view.update(buffer=0, byteOffset=len(payload), byteLength=len(image))
        payload += image
        data["buffers"][0]["byteLength"] = len(payload)
        data["materials"][0]["pbrMetallicRoughness"]["roughnessFactor"] = .8
        encoded = json.dumps(data, separators=(",", ":")).encode()
        encoded += b" " * ((-len(encoded)) % 4)
        payload += bytes((-len(payload)) % 4)
        output = struct.pack("<III", 0x46546C67, 2, 28 + len(encoded) + len(payload))
        output += struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
        output += struct.pack("<II", len(payload), 0x004E4942) + payload
        path = ASSETS / f"box-pbr-{codec}.glb"
        path.write_bytes(output)
        print(f"{path.name}: {hashlib.sha256(output).hexdigest()}")


if __name__ == "__main__":
    main()
