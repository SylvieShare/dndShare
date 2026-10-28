"""Semantic controls for focused native API scenarios; no coordinate-specific product selectors."""
import re
import time


def visible_input_bounds(tree, node):
    """UIAutomator may report an EditText outside its clipped scroll viewport."""
    bounds = list(map(int, re.findall(r'\d+', node.get('bounds', ''))))
    parents = {child: parent for parent in tree.iter() for child in parent}
    current = parents.get(node)
    while current is not None:
        clip = list(map(int, re.findall(r'\d+', current.get('bounds', ''))))
        if len(clip) == 4 and clip[2] > clip[0] and clip[3] > clip[1]:
            bounds = [max(bounds[0], clip[0]), max(bounds[1], clip[1]),
                      min(bounds[2], clip[2]), min(bounds[3], clip[3])]
        current = parents.get(current)
    if len(bounds) != 4 or bounds[2] <= bounds[0] or bounds[3] <= bounds[1]:
        raise AssertionError('Native input has no visible hit area')
    return f'[{bounds[0]},{bounds[1]}][{bounds[2]},{bounds[3]}]'


class NativeControls:
    def __init__(self, device):
        self.device = device

    def scroll(self, tree, reverse=False):
        nodes=[n for n in tree.iter('node') if n.get('scrollable')=='true']
        if not nodes:return
        left,top,right,bottom=map(int,re.findall(r'\d+',nodes[-1].get('bounds','')))
        x=(left+right)//2
        self.device.shell('input','swipe',str(x),str(top+24 if reverse else bottom-24),str(x),str(bottom-24 if reverse else top+24),'300')

    def find(self, label, description=False):
        attribute='content-desc' if description else 'text'
        for reverse in (False,True):
            previous=None
            for _ in range(12):
                tree=self.device.tree()
                matches=[n for n in tree.iter('node') if n.get(attribute)==label]
                if matches:return matches[-1]
                signature=[(n.get('text'),n.get('content-desc'),n.get('bounds')) for n in tree.iter('node')]
                if signature==previous:break
                previous=signature
                self.scroll(tree,reverse)
        raise AssertionError('Native control is not reachable: '+label)

    def click(self,label,description=False):
        self.device.tap(self.find(label,description))

    def keyboard_close(self):
        insets = self.device.shell('dumpsys', 'window')
        visible = bool(re.search(r'InsetsSource[^\n]*type=ime[^\n]*visible=true', insets))
        if visible and 'mInputShown=true' in self.device.shell('dumpsys','input_method'):
            self.device.shell('input','keyevent','4')

    def enter(self,label,value):
        self.keyboard_close()
        for reverse in (False,True):
            previous=None
            for _ in range(12):
                tree=self.device.tree()
                edits=[n for n in tree.iter('node') if n.get('class')=='android.widget.EditText']
                selected=next((n for n in edits if n.get('content-desc')==label),None)
                if selected is None:
                    descriptions=[n for n in tree.iter('node') if n.get('content-desc')==label]
                    for description in descriptions:
                        area=list(map(int,re.findall(r'\d+',description.get('bounds',''))))
                        for candidate in edits:
                            box=list(map(int,re.findall(r'\d+',candidate.get('bounds',''))))
                            if len(area)==4 and len(box)==4 and area[0]<=(box[0]+box[2])//2<area[2] and area[1]<=(box[1]+box[3])//2<area[3]:
                                selected=candidate;break

                if selected is None:
                    for caption in tree.iter('node'):
                        if caption.get('text')!=label:continue
                        box=list(map(int,re.findall(r'\d+',caption.get('bounds',''))))
                        for candidate in edits:
                            bounds=list(map(int,re.findall(r'\d+',candidate.get('bounds',''))))
                            if len(box)==4 and len(bounds)==4 and bounds[0]<=box[0]<bounds[2] and bounds[1]<=box[1]<bounds[3]:selected=candidate;break
                if selected is not None:
                    visible = visible_input_bounds(tree, selected)
                    area = list(map(int, re.findall(r'\d+', visible)))
                    original = list(map(int, re.findall(r'\d+', selected.get('bounds', ''))))
                    if area[3] - area[1] < min(48, original[3] - original[1]):
                        self.scroll(tree, reverse)
                        continue
                    target = dict(selected.attrib, bounds=visible)
                    self.device.tap(target)
                    self.device.tree()  # Let the input connection and IME insets settle before hardware keys.
                    self.device.shell('input','keyevent','123')
                    for _ in range(len(selected.get('text',''))+2):self.device.shell('input','keyevent','67')
                    self.device.shell('input','text',str(value).replace(' ','%s'))
                    self.device.tree()
                    return
                signature=[(n.get('text'),n.get('bounds')) for n in tree.iter('node')]
                if signature==previous:break
                previous=signature
                self.scroll(tree,reverse)
        raise AssertionError('Native input is not reachable: '+label)

    def wait(self,predicate,label):
        deadline=time.monotonic()+35
        while time.monotonic()<deadline:
            if predicate():return
            time.sleep(.2)
        self.device.tree()
        raise AssertionError('Native API result did not arrive: '+label)
