# Fixture

`box.glb` is the Khronos glTF Sample Assets Box model, used only in tests.
Copyright 2017 Cesium. License:
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/legalcode).

Source: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Box

It is not part of the application or the commercial map model catalogue.

SHA-256 of `box.glb`:
`ed52f7192b8311d700ac0ce80644e3852cd01537e4d62241b9acba023da3d54e`.

`box-meshopt.glb` is the same attributed geometry, modified by encoding with
`@gltf-transform/core/extensions/functions` 4.5.1 and `meshoptimizer` 1.3.0,
using `meshopt({ encoder: MeshoptEncoder, level: 'medium' })`.
It exercises `EXT_meshopt_compression` and `KHR_mesh_quantization` in Filament.
The committed fixtures make normal Android checks independent of Node/model tools.

SHA-256 of `box-meshopt.glb`:
`582fb8aabc88acdfae6e99323ccf66240a793b393b5682d57c900bc647f8ee68`.
