"""Measured attachments fitted to the accepted kobold miniature in cell units."""
import math
import random
from mathutils import Vector
from miniature_geometry import Geometry, frame
from kobold_clothing import Clothing

UP = Vector((0, 0, 1))
FRONT = Vector((-.72, -.69, 0)).normalized()
RIGHT = Vector((-.69, .72, 0)).normalized()


class Equipment:
    def __init__(self, anchors, lod=False, surface=None, shadow=False):
        self.a = {k: Vector(v) for k, v in anchors.items() if k != 'normals'}
        self.normals = {k: Vector(v) for k, v in anchors['normals'].items()}
        self.g = Geometry(lod)
        self.surface = surface
        self.clothing = Clothing(self.g, surface, FRONT, RIGHT, shadow)
        self.wood = self.g.material('Dark wood', (.09, .035, .012), .9)
        self.leather = self.g.material('Dark brown leather', (.045, .016, .007), .92)
        self.steel = self.g.material('Satin steel', (.32, .36, .39), .42, .85)
        self.gold = self.g.material('Old brass', (.32, .17, .035), .5, .65)
        self.bone = self.g.material('Ivory bone', (.59, .52, .36), .88)
        self.cloth = self.g.material('Burgundy cloth', (.08, .008, .026), .95)
        self.back = self.a['chest'] - FRONT * .25 + UP * .025

    def spear(self, magical=False):
        grip = self.a['grip']
        axis = (UP + FRONT * .08).normalized()
        bottom, top = grip - axis * .34, grip + axis * .59
        self.g.rod('Straight spear shaft', bottom, top, .011, self.wood)
        self.g.rod('Spear ferrule', top - axis * .035, top + axis * .02, .017, self.gold)
        if magical:
            gem = self.g.material('Green spell crystal', (.012, .45, .065), .28, .1, .25)
            self.g.gemstone('Staff crystal', top + axis * .06, .055, gem)
            for sign in [-1, 1]:
                side = RIGHT * .035 * sign
                self.g.tube('Brass crystal prong', [top, top + side + UP * .035,
                    top + side * .6 + UP * .09], .007, self.gold)
        else:
            side = RIGHT * .026
            p, q = top + axis * .005, top + axis * .15
            normal = axis.cross(RIGHT).normalized() * .005
            vertices = [p - side, p + side, q, p + normal, p - normal]
            self.g.mesh('Leaf spearhead', vertices, [(0, 1, 3), (1, 2, 3), (2, 0, 3),
                (1, 0, 4), (2, 1, 4), (0, 2, 4)], self.steel)
        for z in [-.025, 0, .025]:
            self.g.ring('Grip leather winding', grip + UP * z, axis, .012, .003, self.leather)

    def sword(self):
        root, tip = self.a['blade-root'], self.a['blade-tip']
        axis = (tip - root).normalized()
        side = axis.cross(UP).normalized()
        normal = axis.cross(side).normalized()
        end = root + axis * .37
        vertices = [root - side * .024, root + side * .024,
            end + side * .012, end + axis * .055, end - side * .012,
            root + normal * .004, root - normal * .004]
        faces = []
        for i in range(5):
            faces += [(i, (i + 1) % 5, 5), ((i + 1) % 5, i, 6)]
        self.g.mesh('Short sword blade', vertices, faces, self.steel)
        self.g.rod('Short sword crossguard', root - side * .05, root + side * .05, .009, self.steel)
        self.g.rod('Short sword grip', self.a['grip'] + axis * -.025, root, .015, self.leather)

    def shield(self):
        centre = self.a['palm'] + FRONT * .055 + UP * .08
        axis = (FRONT - RIGHT * .25 + UP * .06).normalized()
        obj = self.g.sphere('Wood shield body', centre, (.19, .24, .025), self.wood, axis)
        rotation = obj.rotation_euler.to_matrix()
        rim = self.g.ring('Shield brass rim', centre + axis * .017, axis, .197, .009, self.gold)
        rim.scale.y = 1.2
        scales = self.g.material('Teal dragon shield scales', (.012, .15, .19), .72, .25)
        for row in range(7):
            for col in range(5):
                x = (col - 2) * .066 + (row % 2 - .5) * .023
                y = (row - 3) * .059
                if (x / .18) ** 2 + (y / .23) ** 2 > .82:
                    continue
                outline = [(-.034, .024), (.034, .024), (.036, -.004),
                    (.023, -.03), (0, -.039), (-.023, -.03), (-.036, -.004)]
                local = []
                for dx, dy in outline + [(0, 0)]:
                    px, py = x + dx, y + dy
                    z = .027 * math.sqrt(max(.05, 1 - (px / .20) ** 2 - (py / .25) ** 2)) + .009
                    local.append(Vector((px, py, z + (.004 if dx == dy == 0 else 0))))
                self.g.mesh('Overlapping shield scale', [centre + rotation @ p for p in local],
                    [(i, (i + 1) % 7, 7) for i in range(7)], scales, thickness=.004)
        self.g.sphere('Raised shield boss', centre + axis * .058, (.045, .045, .022), self.gold, axis)
        for angle in range(0, 360, 45):
            a = math.radians(angle)
            p = centre + rotation @ Vector((math.cos(a) * .18, math.sin(a) * .217, .027))
            self.g.sphere('Shield rivet', p, (.007, .007, .005), self.steel, axis)

    def dress(self, material, hem=.39, fur=None, cloak=False):
        if cloak:
            self.clothing.cloak(material, self.leather)
        else:
            self.clothing.tunic(material, self.leather, hem=hem, fur=fur)
            buckle = self.clothing.point(0, .443, .018, False)
            self.g.box('Attached belt buckle', buckle, (.035, .009, .022), self.gold, frame(FRONT))

    def backpack(self, mechanical=False):
        centre = self.clothing.point(math.pi, .57, .008, False) - FRONT * .06 + UP * .015
        self.pack_centre = centre
        self.g.box('Backpack frame', centre, (.22, .12, .22), self.leather, frame(FRONT))
        for sign in [-1, 1]:
            p = centre + RIGHT * sign * .071
            self.g.rod('Brass pressure tank' if mechanical else 'Backpack rolled blanket',
                p - UP * .12, p + UP * .13, .047, self.gold if mechanical else self.wood)
            for z in [-.07, .08]:
                self.g.ring('Pack retaining strap', p + UP * z, UP, .049, .008, self.leather)
        for sign in [-1, 1]:
            points = [centre + RIGHT * sign * .085 + UP * .105]
            points += [self.clothing.point(sign * a, z, .012, False)
                for a, z in [(2.4,.64),(1.55,.65),(.68,.61),(.65,.54),(.65,.445),(1.55,.445)]]
            points.append(centre + RIGHT * sign * .085 - UP * .105)
            self.g.tube('Fitted shoulder and waist pack strap', points, .008, self.leather)
        if mechanical:
            self.g.ring('Pressure gauge rim', centre - FRONT * .09 + UP * .03, -FRONT, .028, .006, self.steel)
            self.g.sphere('Gauge face', centre - FRONT * .093 + UP * .03, (.024, .024, .003), self.bone, -FRONT)

    def goggles(self):
        lens = self.g.material('Dark green glass lenses', (.008, .13, .10), .26, .5)
        for side in ['eye-left', 'eye-right']:
            p, n = self.a[side], self.normals[side]
            self.g.ring('Goggle brass eye rim', p + n * .008, n, .021, .0045, self.gold)
            self.g.sphere('Goggle green lens', p + n * .009, (.018, .014, .003), lens, n)

    def cannon(self):
        wrist, palm = self.a['wrist'], self.a['palm']
        axis = (FRONT + UP * .15).normalized()
        centre = palm + UP * .09 + FRONT * .03
        self.g.rod('Alchemical projector barrel', centre - axis * .07, centre + axis * .17, .031, self.gold)
        for t in [-.045, 0, .05, .10, .15]:
            self.g.ring('Barrel cooling ring', centre + axis * t, axis, .033, .006, self.steel)
        self.g.sphere('Dark projector bore', centre + axis * .174, (.026, .026, .003), self.leather, axis)
        self.g.rod('Forearm projector bracket', wrist, centre - axis * .03, .019, self.steel)
        start = self.pack_centre - FRONT * .075
        self.g.tube('Alchemical hose', [start, start - RIGHT * .22 - UP * .07,
            palm - UP * .05 - FRONT * .08, centre - axis * .05], .012, self.leather)

    def tools(self):
        centre = self.a['belt'] + FRONT * .04
        self.g.box('Tool belt pouch', centre - RIGHT * .14, (.11, .05, .09), self.leather, frame(FRONT))
        for i, rgb in enumerate([(.03, .23, .11), (.26, .04, .02), (.025, .09, .26)]):
            mat = self.g.material('Potion ' + str(i), rgb, .45)
            p = centre + RIGHT * (.01 + i * .065) - UP * .035
            self.g.sphere('Potion flask', p, (.024, .024, .032), mat)
            self.g.rod('Flask neck', p + UP * .02, p + UP * .05, .011, self.gold)
            self.g.ring('Bottle belt loop', p, UP, .025, .004, self.leather)
        p = self.pack_centre + RIGHT * .105 - FRONT * .062
        self.g.rod('Spanner handle', p - UP * .05, p + UP * .22, .012, self.steel)
        self.g.ring('Spanner jaw', p + UP * .24, FRONT, .025, .008, self.steel)
        self.g.tube('Spanner retaining loop', [p-RIGHT*.018-UP*.01,
            p-FRONT*.014,p+RIGHT*.018-UP*.01], .004, self.leather)

    def wings(self, mechanical=False):
        leather = self.g.material('Burnt orange wing membrane', (.30, .055, .018), .87)
        bones = self.gold if mechanical else self.g.material('Wing finger scales', (.19, .035, .012), .8)
        span = .45 if mechanical else .58
        for sign in [-1, 1]:
            root = self.back + RIGHT * sign * .13 + UP * .06 - FRONT * .025
            elbow = root + RIGHT * sign * .20 + UP * .20 - FRONT * .035
            tip = root + RIGHT * sign * span + UP * .24 - FRONT * .06
            fingers = [tip, root + RIGHT * sign * (span - .06) - UP * .04,
                root + RIGHT * sign * .25 - UP * .18, root - UP * .13]
            boundary = [elbow, tip]
            for start, end in zip(fingers, fingers[1:]):
                control = (start + end) * .35 + root * .30
                for j in range(1, 5):
                    t = j / 4
                    boundary.append(start * (1-t)**2 + control * (2*t*(1-t)) + end * t*t)
            vertices, faces = [root], []
            rings = 2 if self.g.lod else 4
            count = len(boundary)
            for ring in range(1, rings + 1):
                t = ring / rings
                vertices += [root*(1-t) + point*t - FRONT*(math.sin(math.pi*t)*.018) for point in boundary]
            for i in range(count-1):
                faces.append((0, i+1, i+2))
            for ring in range(rings-1):
                for i in range(count-1):
                    a = 1 + ring*count + i
                    faces.append((a, a+1, a+count+1, a+count))
            wing = self.g.mesh('Curved scalloped wing membrane', vertices, faces, leather, thickness=.004)
            for face in wing.data.polygons:
                face.use_smooth = True
            self.g.rod('Wing upper arm', root, elbow, .022, bones)
            for point in fingers:
                self.g.rod('Wing finger rib', elbow, point, .008 if mechanical else .012, bones, tip=.004)
            self.g.rod('Wing claw tip', tip - RIGHT * sign * .025, tip + UP * .024, .011, self.bone, tip=0)

    def crossbow(self):
        centre = self.clothing.point(math.pi, .55, .035, False)
        axis = (UP + RIGHT * .2).normalized()
        self.g.rod('Slung hand crossbow stock', centre - axis * .12, centre + axis * .14, .017, self.wood)
        bow = centre + axis * .06
        self.g.tube('Crossbow steel limbs', [bow - RIGHT * .11 - FRONT * .025,
            bow - RIGHT * .05, bow + RIGHT * .05, bow + RIGHT * .11 - FRONT * .025], .008, self.steel)
        self.g.tube('Taut crossbow string', [bow - RIGHT * .11 - FRONT * .025,
            centre - axis * .07, bow + RIGHT * .11 - FRONT * .025], .0025, self.bone)
        self.g.tube('Crossbow back sling', [self.clothing.point(2.5,.63,.012,False),
            centre+axis*.08,self.clothing.point(3.7,.46,.012,False)], .006, self.leather)

    def winter(self):
        coat = self.g.material('Winter hide coat', (.095, .045, .018), .98)
        fur = self.g.material('Warm ivory fur', (.45, .39, .28), .96)
        self.dress(coat, hem=.36, fur=fur)
        for name, wrist, grip in [('Left', self.a['wrist'], self.a['palm']),
            ('Right', self.a['wrist-right'], self.a['grip'])]:
            self.g.fur(name + ' winter cuff', wrist, grip - wrist, .047, fur, 1636)
        p = self.clothing.point(math.pi, .58, .018, False) + RIGHT * .065 + UP * .04
        self.g.rod('Slung winter javelin', p - UP * .28, p + UP * .36, .009, self.wood)
        self.g.rod('Javelin iron tip', p + UP * .35, p + UP * .46, .022, self.steel, tip=0)
        for z in [.53, .635]:
            anchor = self.clothing.point(math.pi-.55, z, .012, False)
            shaft = Vector((p.x,p.y,z))
            self.g.tube('Attached javelin lashing', [anchor-RIGHT*.01,
                shaft-RIGHT*.012,shaft+RIGHT*.012,anchor+RIGHT*.01], .005, self.leather)

    def vampire(self):
        self.dress(self.g.material('Tattered charcoal cape', (.012, .009, .017), .97), cloak=True)
        red = self.g.material('Blood red eyes', (.42, .004, .012), .5, 0, .12)
        for side in ['eye-left', 'eye-right']:
            p, n = self.a[side], self.normals[side]
            self.g.sphere('Small crimson vampire eye', p + n * .003, (.010, .006, .002), red, n)
        jaw = self.a['jaw']
        for sign in [-1, 1]:
            p = jaw + RIGHT * sign * .028 + UP * .008
            self.g.rod('Visible vampire fang', p, p - UP * .032, .006, self.bone, tip=0)
        wrist, grip = self.a['wrist-right'], self.a['grip']
        axis = (grip-wrist).normalized()
        side = UP.cross(axis).normalized()
        skin = self.g.material('Ashen claw skin',(.13,.155,.17),.86)
        nail = self.g.material('Dark vampire talons',(.022,.025,.028),.65)
        self.g.sphere('Open vampire palm',grip-axis*.018,(.038,.030,.045),skin,axis)
        self.g.rod('Vampire wrist',wrist,grip-axis*.012,.026,skin,tip=.032)
        for i in range(4):
            start=grip+side*(i-1.5)*.017
            middle=start+axis*.029-UP*.018
            end=middle+FRONT*.018-UP*.021
            self.g.rod('Vampire finger upper',start,middle,.011,skin,tip=.009)
            self.g.sphere('Vampire finger knuckle',middle,(.011,.011,.011),skin)
            self.g.rod('Vampire finger lower',middle,end,.009,skin,tip=.007)
            self.g.rod('Curled vampire talon',end,end+FRONT*.018-UP*.027,.009,nail,tip=0)

    def build(self, kind):
        if kind == 'icewind':
            self.winter()
        elif kind == 'underling':
            self.sword()
            self.dress(self.leather)
            self.crossbow()
        elif kind == 'dragonshield':
            self.spear()
            self.shield()
            self.dress(self.leather)
        elif kind == 'inventor':
            self.goggles()
            self.backpack()
            self.tools()
            self.dress(self.leather, hem=.36)
        elif kind == 'sorcerer':
            self.spear(magical=True)
            self.dress(self.cloth, hem=.32)
            orb = self.g.material('Green spell orb', (.01, .28, .04), .38, .1, .22)
            self.g.gemstone('Held spell focus', self.a['palm'] + UP * .085, .052, orb)
            self.g.ring('Spell focus orbit', self.a['palm'] + UP * .085, UP, .073, .005, self.gold)
        elif kind == 'tinkerer':
            self.goggles()
            self.backpack(mechanical=True)
            self.wings(mechanical=True)
            self.cannon()
        elif kind == 'vampire':
            self.vampire()
        elif kind == 'winged':
            self.wings()
            self.g.gemstone('Held throwing stone', self.a['palm'] + UP * .055, .059,
                self.g.material('Throwing rock', (.12, .13, .14), .97))
        return self.g.objects
