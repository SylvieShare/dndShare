"""Public model previews require transparent corners, including cached renders."""
import bpy


def transparent_preview(path):
    if not path.exists():
        return False
    image = bpy.data.images.load(str(path), check_existing=False)
    try:
        width, height = image.size
        return image.channels == 4 and all(image.pixels[index*4+3] == 0
            for index in (0, width-1, (height-1)*width, width*height-1))
    finally:
        bpy.data.images.remove(image)
