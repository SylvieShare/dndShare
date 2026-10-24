import {
  AmbientLight,
  BoxGeometry,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PCFShadowMap,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { createTileLayer } from '../../../src/features/maps/rendering/tileLayer'
import { createTilePreview } from '../../../src/features/maps/rendering/tilePreview'
import { createShadowProxies } from '../../../src/features/maps/rendering/shadowProxies'
import { acquireModelLoader } from '../../../src/shared/model3d/modelLoader'

const gpu = new WebGLRenderer({ antialias: false })
gpu.setSize(192, 192)
gpu.shadowMap.type = PCFShadowMap
gpu.shadowMap.enabled = true
document.body.append(gpu.domElement)
const target = new WebGLRenderTarget(192, 192)
const camera = new OrthographicCamera(-0.62, 0.62, 0.62, -0.62, 0.1, 20)
camera.position.set(0.5, 4, 0.5)
camera.up.set(0, 0, -1)
camera.lookAt(0.5, 0, 0.5)
camera.updateMatrixWorld(true)
const fog = { material: (material) => material }
const reflection = new Matrix4().makeScale(-1, 1, 1)
function originalModel() {
  const geometry = new PlaneGeometry(1, 1, 4, 4)
  geometry.computeTangents()
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, 0.2, 0)
  const pixels = new Uint8Array(8 * 8 * 4)
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const n = new Vector3(
          0.3 * Math.sin(x),
          0.7 * Math.cos(y * 2),
          1,
        ).normalize(),
        i = (y * 8 + x) * 4
      pixels.set(
        [
          Math.round((n.x + 1) * 127.5),
          Math.round((n.y + 1) * 127.5),
          Math.round((n.z + 1) * 127.5),
          255,
        ],
        i,
      )
    }
  const normalMap = new DataTexture(pixels, 8, 8, RGBAFormat)
  normalMap.needsUpdate = true
  return {
    parts: [
      {
        geometry,
        matrix: new Matrix4(),
        material: new MeshStandardMaterial({
          color: 0xb98751,
          normalMap,
          roughness: 1,
          side: DoubleSide,
        }),
      },
    ],
  }
}
function bakedModel(source) {
  return {
    parts: source.parts.map((part) => {
      const geometry = part.geometry
        .clone()
        .applyMatrix4(reflection.clone().multiply(part.matrix))
      const tangent = geometry.attributes.tangent
      if (tangent)
        for (let i = 0; i < tangent.count; i++)
          tangent.setW(i, -tangent.getW(i))
      if (!geometry.index)
        geometry.setIndex(
          Array.from(
            { length: geometry.attributes.position.count },
            (_, i) => i,
          ),
        )
      for (let i = 0; i < geometry.index.count; i += 3) {
        const b = geometry.index.getX(i + 1)
        geometry.index.setX(i + 1, geometry.index.getX(i + 2))
        geometry.index.setX(i + 2, b)
      }
      return { ...part, geometry, matrix: new Matrix4() }
    }),
  }
}
async function compare({
  legacy = false,
  normalMap = true,
  shadows = false,
  preview = false,
  rotation = 0,
  url,
  shadowURL,
  metadata = { width: 1, height: 1, mountDepth: 0 },
} = {}) {
  let source, loader
  if (url) {
    loader = acquireModelLoader(gpu)
    const gltf = await loader.load(url)
    gltf.scene.updateMatrixWorld(true)
    source = { parts: [] }
    gltf.scene.traverse((node) => {
      if (node.isMesh)
        source.parts.push({
          geometry: node.geometry,
          material: node.material,
          matrix: node.matrixWorld.clone(),
        })
    })
  } else source = originalModel()
  let shadowSource
  if (shadowURL) {
    const gltf = await loader.load(shadowURL)
    gltf.scene.updateMatrixWorld(true)
    shadowSource = { parts: [] }
    gltf.scene.traverse((node) => {
      if (node.isMesh)
        shadowSource.parts.push({
          geometry: node.geometry,
          material: node.material,
          matrix: node.matrixWorld.clone(),
        })
    })
  }
  const bakedShadow = shadowSource && bakedModel(shadowSource)
  const baked = bakedModel(source),
    tile = {
      id: 'tile',
      modelId: 'model',
      x: 0,
      y: 0,
      level: 0,
      rotation,
      mirrored: true,
      elevation: 0,
    }
  function capture(model, mirrored) {
    const metadataMap = { id: 'model', ...metadata }
    const assets = {
      model: (_id, tier) =>
        tier === 'shadow' && shadowSource
          ? mirrored
            ? shadowSource
            : bakedShadow
          : model,
      metadata: () => metadataMap,
    }
    const scene = new Scene(),
      light = new DirectionalLight(0xffffff, 3)
    scene.add(new AmbientLight(0xffffff, 0.15))
    light.position.set(-2, 4, 3)
    scene.add(light, light.target)
    light.castShadow = shadows
    light.shadow.mapSize.set(512, 512)
    light.shadow.normalBias = 0.02
    light.shadow.camera.left = light.shadow.camera.bottom = -2
    light.shadow.camera.right = light.shadow.camera.top = 2
    const item = { ...tile, mirrored }
    const layer = preview
      ? createTilePreview(assets)
      : createTileLayer(assets, fog)
    if (preview) {
      layer.update({ ...item, tileIds: ['tile'] }, [item])
      layer.advance(2000)
    } else layer.rebuild([item], 'render')
    scene.add(layer.root)
    const maps = []
    layer.root.traverse((node) => {
      for (const material of Array.isArray(node.material)
        ? node.material
        : node.material
          ? [node.material]
          : []) {
        if (!normalMap) {
          maps.push([material, material.normalMap])
          material.normalMap = null
        }
        if (legacy && node.userData.reflected) {
          material.onBeforeCompile = () => {}
          material.customProgramCacheKey = () => 'legacy-reflection-control'
        }
      }
    })
    let proxies
    if (shadows) {
      proxies = createShadowProxies(assets)
      proxies.update(
        { tiles: [item], objects: [], areas: [] },
        [item],
        [],
        {},
        null,
      )
      proxies.advance(layer.transform, { children: [] })
      scene.add(proxies.root)
      const box = new Mesh(
        new BoxGeometry(0.12, 0.3, 0.12),
        new MeshStandardMaterial(),
      )
      box.position.set(0.75, 0.5, 0.75)
      box.castShadow = true
      scene.add(box)
    }
    scene.updateMatrixWorld(true)
    gpu.setRenderTarget(target)
    gpu.clear()
    gpu.render(scene, camera)
    const pixels = new Uint8Array(192 * 192 * 4)
    gpu.readRenderTargetPixels(target, 0, 0, 192, 192, pixels)
    layer.destroy()
    proxies?.destroy()
    light.shadow.map?.dispose()
    return pixels
  }
  const actual = capture(source, true),
    expected = capture(baked, false)
  let total = 0,
    max = 0,
    changed = 0
  for (let i = 0; i < actual.length; i++) {
    if (i % 4 === 3) continue
    const error = Math.abs(actual[i] - expected[i])
    total += error
    max = Math.max(max, error)
    if (error > 2) changed++
  }
  loader?.release()
  return { mean: total / (192 * 192 * 3), max, changed }
}
window.mirrorShading = { compare }
