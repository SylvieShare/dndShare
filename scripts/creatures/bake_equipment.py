"""Bake subtle painted material grain into portable equipment texture atlases."""
from pathlib import Path
import bpy


def bake_equipment(objects, body, folder, role):
    if not objects:
        return
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.1, island_margin=.012)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.data.uv_layers.active.name = body.data.uv_layers.active.name
    originals = {}
    for mat in obj.data.materials:
        shader = mat.node_tree.nodes.get('Principled BSDF')
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        colour = tuple(shader.inputs['Base Color'].default_value)
        strength = .11 if any(w in mat.name.lower() for w in ['cloth','leather','fur','coat','wood','membrane']) else .035
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 85
        noise.inputs['Detail'].default_value = 2
        ramp = nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = tuple(c * (1-strength) for c in colour[:3]) + (1,)
        ramp.color_ramp.elements[1].color = tuple(min(1,c * (1+strength)) for c in colour[:3]) + (1,)
        links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
        links.new(ramp.outputs['Color'], shader.inputs['Base Color'])
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .12
        bump.inputs['Distance'].default_value = .002
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], shader.inputs['Normal'])
        originals[mat] = (shader, ramp)
    context = bpy.context.scene
    context.render.engine, context.cycles.device, context.cycles.samples = 'CYCLES','CPU',1
    context.render.threads_mode, context.render.threads = 'FIXED',8
    size = 512 if role == 'lod' else 1024
    maps = {}
    for kind in ['normal','basecolor','orm']:
        image = bpy.data.images.new(f'Equipment {role} {kind}',width=size,height=size,alpha=False)
        image.colorspace_settings.name = 'sRGB' if kind == 'basecolor' else 'Non-Color'
        if kind == 'normal':
            image.generated_color = (.5,.5,1,1)
        for mat,(shader,ramp) in originals.items():
            node = mat.node_tree.nodes.new('ShaderNodeTexImage')
            node.image = image
            mat.node_tree.nodes.active = node
            if kind != 'normal':
                emission = mat.node_tree.nodes.new('ShaderNodeEmission')
                output = next(n for n in mat.node_tree.nodes if n.type == 'OUTPUT_MATERIAL')
                value = ramp.outputs['Color']
                if kind == 'orm':
                    packed = mat.node_tree.nodes.new('ShaderNodeCombineColor')
                    packed.inputs[0].default_value = 1
                    packed.inputs[1].default_value = shader.inputs['Roughness'].default_value
                    packed.inputs[2].default_value = shader.inputs['Metallic'].default_value
                    value = packed.outputs[0]
                mat.node_tree.links.new(value,emission.inputs['Color'])
                mat.node_tree.links.new(emission.outputs['Emission'],output.inputs['Surface'])
        print('Baking equipment',role,kind,flush=True)
        bpy.ops.object.bake(type='NORMAL' if kind=='normal' else 'EMIT',margin=6)
        image.filepath_raw = str(Path(folder)/f'{role}-equipment-{kind}.png')
        image.file_format = 'PNG'
        image.save()
        maps[kind] = image
    # One material atlas avoids a GPU draw per rivet, fur tuft or paint colour.
    unified = bpy.data.materials.new('Painted equipment atlas')
    unified.use_nodes = True
    unified.use_backface_culling = True
    nodes,links = unified.node_tree.nodes,unified.node_tree.links
    shader = nodes.get('Principled BSDF')
    colour = nodes.new('ShaderNodeTexImage');colour.image = maps['basecolor']
    normal = nodes.new('ShaderNodeTexImage');normal.image = maps['normal']
    orm = nodes.new('ShaderNodeTexImage');orm.image = maps['orm']
    mapped = nodes.new('ShaderNodeNormalMap')
    channels = nodes.new('ShaderNodeSeparateColor')
    links.new(normal.outputs['Color'],mapped.inputs['Color'])
    links.new(mapped.outputs['Normal'],shader.inputs['Normal'])
    links.new(colour.outputs['Color'],shader.inputs['Base Color'])
    links.new(orm.outputs['Color'],channels.inputs[0])
    links.new(channels.outputs['Green'],shader.inputs['Roughness'])
    links.new(channels.outputs['Blue'],shader.inputs['Metallic'])
    materials,indices,glows = [unified],[],{}
    for old in obj.data.materials:
        previous = originals[old][0]
        strength = previous.inputs['Emission Strength'].default_value
        if strength > 0:
            colour = tuple(previous.inputs['Emission Color'].default_value)
            key = (colour,strength)
            if key not in glows:
                glow = unified.copy()
                node = glow.node_tree.nodes.get('Principled BSDF')
                node.inputs['Emission Color'].default_value = colour
                node.inputs['Emission Strength'].default_value = strength
                glows[key] = len(materials);materials.append(glow)
            indices.append(glows[key])
        else:
            indices.append(0)
    assignments = [indices[p.material_index] for p in obj.data.polygons]
    obj.data.materials.clear()
    for mat in materials:
        obj.data.materials.append(mat)
    for face,index in zip(obj.data.polygons,assignments):
        face.material_index = index
