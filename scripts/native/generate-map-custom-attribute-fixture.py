#!/usr/bin/env python3
"""Reproduce catalogue _WATER semantics using the attributed test Box geometry."""
import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'frontend/tests/maps/fixtures/data'
source = (ASSETS / 'box-water.glb').read_bytes()
length = struct.unpack_from('<I', source, 12)[0]
data = json.loads(source[20:20 + length])
binary_length = struct.unpack_from('<I', source, 20 + length)[0]
binary = source[28 + length:28 + length + binary_length]
for mesh in data['meshes']:
    for primitive in mesh['primitives']:
        count = data['accessors'][primitive['attributes']['POSITION']]['count']
        mask = bytes([255, 0]) * count
        binary += bytes((-len(binary)) % 4)
        view = len(data['bufferViews'])
        data['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(mask)})
        binary += mask
        accessor = len(data['accessors'])
        data['accessors'].append({'bufferView': view, 'componentType': 5121, 'count': count, 'type': 'VEC2', 'normalized': True})
        primitive['attributes']['_WATER'] = accessor

data['buffers'][0]['byteLength'] = len(binary)
encoded = json.dumps(data, separators=(',', ':')).encode()
encoded += b' ' * ((-len(encoded)) % 4)
binary += bytes((-len(binary)) % 4)
output = struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary))
output += struct.pack('<II', len(encoded), 0x4e4f534a) + encoded
output += struct.pack('<II', len(binary), 0x004e4942) + binary
path = ASSETS / 'box-water-custom.glb'
path.write_bytes(output)
(ROOT / 'native/fixtures/maps/box-water-custom.glb').write_bytes(output)
print(path.name + ': ' + hashlib.sha256(output).hexdigest())
