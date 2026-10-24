"""Connected garments sampled outward from the accepted miniature's torso.

The measured spine stays inside the torso. Casting from it avoids projecting
cloth onto a hand or weapon in front of the chest. Lower hems hang from the
waist outline; shoulders, neckline and belt remain close to the actual body.
"""
import math
from collections import Counter
from mathutils import Vector

UP = Vector((0, 0, 1))
SPINE = [
    (.40, .055, .140), (.44, .075, .140), (.50, .115, .145),
    (.56, .130, .150), (.62, .125, .160), (.67, .140, .165),
]


class Clothing:
    def __init__(self, geometry, surface, front, right, shadow=False):
        if surface is None:
            raise ValueError('Fitted clothing requires the actual body surface')
        self.g, self.surface = geometry, surface
        self.front, self.right = front, right
        self.attachments = []
        self.pieces = []
        self.coverage = []
        self.count = 24 if shadow else 40 if geometry.lod else 64
        self.rows = 12 if shadow else 20 if geometry.lod else 28

    def centre(self, z):
        for lo, hi in zip(SPINE, SPINE[1:]):
            if z <= hi[0]:
                t = max(0, min(1, (z - lo[0]) / (hi[0] - lo[0])))
                return (self.front * (lo[1] * (1-t) + hi[1] * t)
                    + self.right * (lo[2] * (1-t) + hi[2] * t) + UP * z)
        return self.front * SPINE[-1][1] + self.right * SPINE[-1][2] + UP * z

    def sample(self, angle, z):
        direction = self.front * math.cos(angle) + self.right * math.sin(angle)
        origin = self.centre(z)
        hit = self.surface.ray_cast(origin, direction, .32)[0]
        if hit is None:
            raise ValueError(f'Torso ray missed at angle={angle:.3f}, z={z:.3f}')
        # Native skin includes very close inner/outer surfaces. Walk only that
        # thin cluster, never across the air gap to a separate arm or tail.
        first = hit.copy()
        for _ in range(10):
            following = self.surface.ray_cast(hit + direction * .0001, direction, .025)[0]
            if following is None or (following-first).length > .025:
                break
            hit = following
        return origin, direction, (hit-origin).dot(direction)

    def point(self, angle, z, extra=0, fold=True):
        sample_z = max(.432, z)
        centre, direction, radius = self.sample(angle, sample_z)
        if z < sample_z:
            centre = self.centre(z)
            radius += (sample_z-z) * .15
        ripple = .002 * (1 + math.cos(angle * 9 + z * 7)) if fold else 0
        return centre + direction * (radius + .012 + extra + ripple)

    @staticmethod
    def top(angle):
        # Scooped front neckline; the side bands go over the shoulders.
        return .658 - .065 * max(0, math.cos(angle)) ** 2

    def boundary(self, obj, material, name):
        edges = Counter(tuple(sorted(e)) for face in obj.data.polygons
            for e in face.edge_keys)
        adjacent = {}
        for (a, b), count in edges.items():
            if count == 1:
                adjacent.setdefault(a, []).append(b)
                adjacent.setdefault(b, []).append(a)
        used = set()
        for start, neighbours in adjacent.items():
            for neighbour in neighbours:
                if tuple(sorted((start, neighbour))) in used:
                    continue
                loop, previous, current = [start], start, neighbour
                while True:
                    used.add(tuple(sorted((previous, current))))
                    loop.append(current)
                    if current == start:
                        break
                    choices = [n for n in adjacent[current] if n != previous
                        and tuple(sorted((current, n))) not in used]
                    if not choices:
                        break
                    previous, current = current, choices[0]
                if len(loop) > 3:
                    self.g.tube(name, [obj.data.vertices[i].co for i in loop], .0022, material)

    def record(self, obj):
        parent = {}
        def root(vertex):
            parent.setdefault(vertex, vertex)
            while parent[vertex] != vertex:
                parent[vertex] = parent[parent[vertex]]
                vertex = parent[vertex]
            return vertex
        for face in obj.data.polygons:
            first = root(face.vertices[0])
            for vertex in face.vertices[1:]:
                parent[root(vertex)] = first
        components = len({root(vertex) for vertex in parent})
        if components != 1:
            raise ValueError(f'{obj.name} has {components} disconnected fabric pieces')
        self.pieces.append({'name':obj.name, 'components':components,
            'faces':len(obj.data.polygons), 'usedVertices':len(parent)})
        edges = Counter(tuple(sorted(e)) for face in obj.data.polygons for e in face.edge_keys)
        boundary = {v for edge, count in edges.items() if count == 1 for v in edge}
        interior = [list(face.vertices) for face in obj.data.polygons
            if not any(v in boundary for v in face.vertices)]
        # Keep skin overlapping every neckline/armhole edge. Coverage is
        # deliberately inset, so trimming cannot open holes beside the cloth.
        self.coverage.append(([v.co.copy() for v in obj.data.vertices],interior))

    def tunic(self, material, trim, hem=.39, fur=None):
        vertices, faces, pinned = [], [], []
        for row in range(self.rows+1):
            t = row/self.rows
            for col in range(self.count):
                angle = col/self.count * math.tau
                z = hem + (self.top(angle)-hem)*t
                if row == 0:
                    z += .003 * math.cos(angle*7)
                point = self.point(angle, z)
                vertices.append(point)
                if row == self.rows or abs(z-.445) < .012:
                    pinned.append(len(vertices)-1)
        for row in range(self.rows):
            t = (row+.5)/self.rows
            for col in range(self.count):
                angle = (col+.5)/self.count*math.tau
                z = hem + (self.top(angle)-hem)*t
                side = math.acos(abs(math.sin(angle)))
                # Actual armholes, with connected side seams below them and
                # shoulder bridges above; never two independent cloth boards.
                if (side/.67)**2 + ((z-.584)/.045)**2 < 1:
                    continue
                # A short front slit lets the hem open around the legs.
                if z < .41 and math.cos(angle) > .97:
                    continue
                nxt = (col+1) % self.count
                faces.append((row*self.count+col, (row+1)*self.count+col,
                    (row+1)*self.count+nxt, row*self.count+nxt))
        obj = self.g.mesh('Connected fitted tunic', vertices, faces, material)
        self.record(obj)
        for face in obj.data.polygons:
            face.use_smooth = True
        self.boundary(obj, trim, 'Sewn garment edge')
        self.thicken(obj)
        self.attachments.extend(obj.data.vertices[i].co.copy() for i in pinned)
        self.belt(trim)
        if fur:
            self.fur_collar(fur)
        return obj

    def thicken(self, obj):
        import bpy
        bpy.context.view_layer.objects.active = obj
        modifier = obj.modifiers.new('Sewn cloth thickness', 'SOLIDIFY')
        modifier.thickness = .003
        modifier.offset = -1
        bpy.ops.object.modifier_apply(modifier=modifier.name)

    def belt(self, material):
        vertices = [self.point(i/self.count*math.tau, z, .008, False)
            for z in [.432, .454] for i in range(self.count)]
        faces = [(i, i+self.count, (i+1)%self.count+self.count, (i+1)%self.count)
            for i in range(self.count)]
        obj = self.g.mesh('Fitted waist belt', vertices, faces, material, thickness=.004)
        for face in obj.data.polygons:
            face.use_smooth = True
        return self.point(0, .443, .016, False)

    def cloak(self, material, trim):
        count = self.count
        vertices, faces = [], []
        for row in range(self.rows+1):
            t = row/self.rows
            for col in range(count+1):
                angle = math.pi - 1.52 + col/count*3.04
                z = .34 + (self.top(angle)-.34)*t
                if row == 0:
                    z += .009 * math.cos(angle*9)
                point = self.point(angle, z, .004*(1-t))
                vertices.append(point)
                if row == self.rows:
                    self.attachments.append(point)
        for row in range(self.rows):
            for col in range(count):
                a = row*(count+1)+col
                faces.append((a, a+count+1, a+count+2, a+1))
        obj = self.g.mesh('Shoulder attached curved cloak', vertices, faces, material)
        self.record(obj)
        for face in obj.data.polygons:
            face.use_smooth = True
        self.boundary(obj, trim, 'Sewn cloak edge')
        self.thicken(obj)
        collar = [self.point(i/count*math.tau, self.top(i/count*math.tau), .001, False)
            for i in range(count+1)]
        self.g.tube('Cloak neckline fastening', collar, .004, trim)

    def fur_collar(self, material):
        path = [self.point(i/self.count*math.tau,
            self.top(i/self.count*math.tau), .003, False) for i in range(self.count+1)]
        self.g.tube('Fitted winter underfur', path, .009, material)
        for i in range(0, self.count, 2):
            angle = i/self.count*math.tau
            outward = self.front*math.cos(angle) + self.right*math.sin(angle)
            start = path[i]
            self.g.rod('Attached winter fur tuft', start + UP*.004,
                start - UP*.025 + outward*.009, .011, material, tip=.001)

    def report(self):
        distances = [self.surface.find_nearest(p)[3] for p in self.attachments]
        if not distances:
            return None
        largest = max(distances)
        if largest > .022:
            raise ValueError(f'Clothing attachment floats {largest:.4f} cells from body')
        return {'attachmentVertices':len(distances), 'maxBodyGap':largest,
            'limit':.022, 'pieces':self.pieces}
