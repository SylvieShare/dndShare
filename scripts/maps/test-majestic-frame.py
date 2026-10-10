"""Compare conservative bounds with the previous exhaustive clip.

Run with Blender --background --python-exit-code 1 --python this_file.
"""
import importlib.util
import random
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('frame', ROOT/'scripts/maps/validate-majestic-frame.py')
frame = importlib.util.module_from_spec(spec)
spec.loader.exec_module(frame)


def reference_collisions(vertices, faces, volumes):
    hit = set()
    for offset, cosine, sine, z0, z1, radius, planes in volumes:
        for index, face in enumerate(faces):
            if index in hit:
                continue
            polygon = [vertices[i]-offset for i in face]
            if max(p.z for p in polygon) < z0 or min(p.z for p in polygon) > z1:
                continue
            polygon = [Vector((cosine*p.x+sine*p.y, -sine*p.x+cosine*p.y, p.z)) for p in polygon]
            if any(min(p[a]*sign for p in polygon) > radius for a, sign in [(0, 1), (0, -1), (1, 1), (1, -1)]):
                continue
            for normal, constant in planes:
                if not polygon:
                    break
                polygon = frame.clip(polygon, normal, constant)
            if len(polygon) >= 3 and (polygon[1]-polygon[0]).cross(polygon[2]-polygon[0]).length > 1e-8:
                hit.add(index)
    return len(hit)



def main():
    rng = random.Random(9104)
    vertices = [Vector(tuple(rng.uniform(-80, 80) for _ in range(3))) for _ in range(900)]
    # Contacts and tiny triangles on either side of the clip inset.
    for z in [0, .009999, .01, .010001, 4.99, 5, 5.01, 9.99, 10]:
        for x in [-10, -9.99, -9.989999, 0, 9.989999, 9.99, 10]:
            vertices += [Vector((x, 0, z)), Vector((x+.0001, .0001, z)), Vector((x+.0001, 0, z+.0001))]
    faces = [tuple(range(i, i+3)) for i in range(0, len(vertices)-2, 3)]
    profiles = [
        {'name': 'taper', 'depthMM': 10, 'sectionsMM': [[0, 7], [5, 9], [10, 10]]},
        {'name': 'ring', 'depthMM': 10, 'holeHalfMM': 4, 'sectionsMM': [[0, 7], [5, 9], [10, 10]]},
    ]
    count, positive = 0, 0
    for profile in profiles:
        for angle in [0, 15, 45, 90, 180, 270]:
            for xy in [(0, 0), (-35, .0038929), (2.71, -7.13)]:
                volumes = list(frame.profile_volumes(profile, 10, xy, angle))
                before = reference_collisions(vertices, faces, volumes)
                after = frame.collisions(vertices, faces, volumes)
                assert before == after, (profile, angle, xy, before, after)
                count += 1
                positive += before > 0
    assert positive == count
    for angle in [0, 45, 90]:
        volumes = list(frame.profile_volumes(profiles[0], 10, (300, -300), angle))
        assert reference_collisions(vertices, faces, volumes) == frame.collisions(vertices, faces, volumes) == 0
    assert frame.collisions([], [], []) == 0
    # A 0.02mm wall displacement moves a grazing hit by 1mm. A real 0.2mm
    # displacement must still fail the unchanged 0.15mm surface tolerance.
    def wall(displacement):
        vertices = [(x, 10+.02*x+displacement, z)
                    for x, z in [(-100, -100), (100, -100), (100, 100), (-100, 100)]]
        return BVHTree.FromPolygons(vertices, [(0, 1, 2), (0, 2, 3)], all_triangles=True)
    native = wall(0)
    origin, direction = Vector((0, 11, 0)), Vector((1, 0, 0))
    before = native.ray_cast(origin, direction, 100)[0]
    for displacement, accepted in [(.02, True), (.2, False)]:
        candidate = wall(displacement)
        after = candidate.ray_cast(origin, direction, 100)[0]
        assert (before-after).length > .15
        drift = frame.surface_drift(native, candidate, before, after)
        assert abs(drift-displacement) < .001, drift
        assert (drift <= .15) == accepted, (displacement, drift)
    print('BROADPHASE_EXACT_EQUIVALENCE', count, 'positive controls', positive, len(faces), 'triangles')
    print('GRAZING_SURFACE_DRIFT', '0.02mm accepted; 0.2mm rejected')


if __name__ == '__main__':
    main()
