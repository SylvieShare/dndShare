package ru.dndshare.client.maps.rendering

import android.content.Context
import com.google.android.filament.*
import com.google.android.filament.gltfio.Gltfio
import com.google.android.filament.utils.Utils

/** The base world outlives all resource/pass owners and is closed last on the render looper. */
internal class MapFilamentWorld(context: Context) : AutoCloseable {
    val engine: Engine
    val view: View
    val scene: Scene
    val renderer: Renderer
    val camera: Camera
    private val background: Skybox

    init {
        Utils.init()
        Gltfio.init()
        engine =
            Engine.Builder()
                .backend(Engine.Backend.OPENGL)
                .config(Engine.Config().apply { enableMultipleDirectionalLights = true })
                .build()
        engine.setAutomaticInstancingEnabled(true)
        renderer = engine.createRenderer()
        scene = engine.createScene()
        val backgroundColour = mapLinearColour("#161b23")
        background =
            Skybox.Builder()
                .color(backgroundColour[0], backgroundColour[1], backgroundColour[2], 1f)
                .build(engine)
        background.setLayerMask(255, 1)
        scene.skybox = background
        camera = engine.createCamera(EntityManager.get().create())
        camera.setExposure(1f)
        view =
            engine.createView().apply {
                this.scene = this@MapFilamentWorld.scene
                this.camera = this@MapFilamentWorld.camera
                antiAliasing = com.google.android.filament.View.AntiAliasing.FXAA
                setVisibleLayers(0xff, 1 or 16 or 64)
                setDynamicLightingOptions(
                    .01f,
                    2000f,
                ) // Orthographic editor eye is 500 units from the map.
            }
        renderer.clearOptions =
            Renderer.ClearOptions().apply {
                clear = true
                clearColor =
                    doubleArrayOf(
                        backgroundColour[0].toDouble(),
                        backgroundColour[1].toDouble(),
                        backgroundColour[2].toDouble(),
                        1.0,
                    )
            }
    }

    override fun close() {
        engine.destroyCameraComponent(camera.entity)
        EntityManager.get().destroy(camera.entity)
        engine.destroyView(view)
        scene.skybox = null
        engine.destroySkybox(background)
        engine.destroyScene(scene)
        engine.destroyRenderer(renderer)
        engine.destroy()
    }
}
