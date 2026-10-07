"""Resumable Blender preparation for all canonical models; bytes remain ignored.

Run Blender --background --python-exit-code 1 --python this_file -- --codes ...
"""
import argparse, json, math, sys, time
from pathlib import Path
import bpy, bmesh
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
MODELS=ROOT/'models'
OUT=MODELS/'collections/prepared'
sys.path.insert(0,str(MODELS/'_tools'))
from prepare_tiles import activate, crop, shade, read_glb
from bake_tiles import unwrap


def material_for(row):
    material=bpy.data.materials.new(row['code']+' stone')
    material.use_nodes=True
    nodes=material.node_tree.nodes;links=material.node_tree.links
    bsdf=nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.9
    noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=.35
    noise.inputs['Detail'].default_value=3
    coord=nodes.new('ShaderNodeTexCoord');links.new(coord.outputs['Object'],noise.inputs['Vector'])
    ramp=nodes.new('ShaderNodeValToRGB')
    palette={'lost-cave':[(.12,.07,.035,1),(.43,.29,.15,1)],
             'ultimate-dungeon':[(.08,.095,.085,1),(.34,.37,.33,1)],
             'toxic-sewer':[(.075,.08,.045,1),(.31,.35,.17,1)],
             'basic-elements':[(.13,.14,.15,1),(.36,.38,.4,1)]}[row['collection']]
    ramp.color_ramp.elements[0].color=palette[0];ramp.color_ramp.elements[1].color=palette[1]
    links.new(noise.outputs['Fac'],ramp.inputs[0]);links.new(ramp.outputs['Color'],bsdf.inputs['Base Color'])
    return material


def texture(target, source, name, kind, directory):
    image=bpy.data.images.new(name,width=512,height=512,alpha=False,is_data=kind=='NORMAL')
    image.colorspace_settings.name='Non-Color' if kind=='NORMAL' else 'sRGB'
    if kind=='NORMAL':image.generated_color=(.5,.5,1,1)
    material=target.data.materials[0];nodes=material.node_tree.nodes
    node=nodes.new('ShaderNodeTexImage');node.image=image;nodes.active=node
    activate(target);source.select_set(True);source.hide_render=False;target.hide_render=False
    bpy.context.scene.render.engine='CYCLES';bpy.context.scene.cycles.device='CPU';bpy.context.scene.cycles.samples=1
    kwargs=dict(type=kind,use_selected_to_active=True,cage_extrusion=.5,max_ray_distance=1.5,margin=6,use_clear=True)
    if kind=='DIFFUSE':kwargs['pass_filter']={'COLOR'}
    bpy.ops.object.bake(**kwargs)
    source.hide_render=True
    image.filepath_raw=str(directory/(name+'.png'));image.file_format='PNG';image.save()
    return node


def preview(obj, path, width, height, top):
    scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE'
    scene.render.resolution_x=256;scene.render.resolution_y=256;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
    scene.world=bpy.data.worlds.new('Preview world');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.09,.105,.13,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
    light=bpy.data.lights.new('Light','SUN');light.energy=3
    lamp=bpy.data.objects.new('Light',light);scene.collection.objects.link(lamp);lamp.rotation_euler=(.4,-.4,-.7)
    camera=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'));scene.collection.objects.link(camera)
    camera.data.type='ORTHO';camera.data.ortho_scale=max(width,height,top,1)*50
    center=Vector((0,0,top*35/2));camera.location=center+Vector((70,-100,85));camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
    scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)


def run(row):
    code=row['code'];slug=row.get('outputSlug',code.replace(' ','_'))
    directory=OUT/row['collection']/slug;directory.mkdir(parents=True,exist_ok=True)
    done=directory/'report.json'
    if done.exists():return json.loads(done.read_text())
    started=time.monotonic();print('START_MODEL',code,flush=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.threads_mode='FIXED';bpy.context.scene.render.threads=8
    bpy.ops.wm.stl_import(filepath=str(MODELS/row['sourcePath']))
    source=bpy.context.object;source.name=code
    if row['cutHeight']>row['min'][2]+.0001:
        try:crop(source,row['cutHeight'],99999999)
        except RuntimeError as error:
            # Keep usable scan meshes; the original STL is still retained verbatim.
            if 'not closed' not in str(error):raise
    else:
        for vertex in source.data.vertices:vertex.co.z-=row['cutHeight']
    shade(source);source.data.materials.append(material_for(row))
    source.hide_render=True
    target=bpy.data.objects.new(code+' browser',source.data.copy());bpy.context.collection.objects.link(target)
    activate(target)
    budget=min(90000,int(20000*math.sqrt(row['width']*row['height'])))
    modifier=target.modifiers.new('Browser budget','DECIMATE');modifier.ratio=min(1,budget/max(1,len(target.data.polygons)));modifier.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=modifier.name);shade(target);unwrap(target)
    target.data.materials[0]=target.data.materials[0].copy()
    normal=texture(target,source,slug+'-normal','NORMAL',directory)
    colour=texture(target,source,slug+'-colour','DIFFUSE',directory)
    shader=target.data.materials[0].node_tree.nodes.get('Principled BSDF');links=target.data.materials[0].node_tree.links
    normal_map=target.data.materials[0].node_tree.nodes.new('ShaderNodeNormalMap')
    links.new(normal.outputs['Color'],normal_map.inputs['Color']);links.new(normal_map.outputs[0],shader.inputs['Normal']);links.new(colour.outputs['Color'],shader.inputs['Base Color'])
    top=max(v.co.z for v in source.data.vertices)/35
    slots=[]
    if row['tileType']=='frame' or row['sourceName'].lower() in ['level','scaffolding level']:
        slots=[{'x':x,'y':y,'width':1,'height':1,'elevation':round(top,6)} for y in range(row['height']) for x in range(row['width'])]
    result={**row,'maxHeight':round(top,6),'supportSlots':slots,'surfaceHeight':round(min(.421143,top),6)}
    for vertex in target.data.vertices:vertex.co/=35
    activate(target)
    file=directory/'model.glb'
    bpy.ops.export_scene.gltf(filepath=str(file),check_existing=False,export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_texcoords=True,export_normals=True,export_tangents=True)
    result['glbPath']=str(file.relative_to(MODELS));result['renderTriangles']=len(target.data.polygons)
    for vertex in target.data.vertices:vertex.co*=35
    preview(target,directory/'preview.png',row['width'],row['height'],top)
    result['previewPath']=str((directory/'preview.png').relative_to(MODELS));result['seconds']=round(time.monotonic()-started,2)
    done.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print('DONE_MODEL',code,result['seconds'],result['renderTriangles'],flush=True)
    return result


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--codes',nargs='*');parser.add_argument('--skip-existing',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    rows=json.loads((MODELS/'collections/manifest.json').read_text())
    if args.codes:rows=[r for r in rows if r['code'] in args.codes]
    previous={m['sourceCode'] for m in json.loads((ROOT/'internal/battlemap/catalogue.json').read_text())}
    if args.skip_existing:rows=[r for r in rows if r['code'] not in previous]
    errors=[]
    for row in rows:
        try:run(row)
        except Exception as error:
            print('FAILED_MODEL',row['code'],repr(error),flush=True);errors.append({'code':row['code'],'error':repr(error)})
    OUT.mkdir(parents=True,exist_ok=True);(OUT/'errors.json').write_text(json.dumps(errors,indent=2)+'\n')
    print('BATCH_COMPLETE',len(rows),'errors',len(errors),flush=True)

if __name__=='__main__':main()
