export function attachmentExample(source, Scene) {
  const beforeRender = Scene.prototype.onBeforeRender;
  Scene.prototype.onBeforeRender = function (...args) {
    beforeRender?.apply(this, args);
    if (this.background) window.attachmentScene = this;
  };
  source.document.objects[0].scale = 0.4;
  source.document.lightingEnabled = true;
  source.document.sun = { enabled: true, angle: 225, elevation: 45 };
  source.document.lights = [
    {
      id: "tile-lamp",
      name: "На плитке",
      color: "#ff44ee",
      offset: [-0.3, 0],
      anchor: { kind: "tile", id: "area-floor" },
    },
    {
      id: "object-lamp",
      name: "На сундуке",
      color: "#44ee44",
      offset: [0.3, 0],
      anchor: { kind: "object", id: "area-chest" },
    },
  ].map((l) => ({
    ...l,
    kind: "magic",
    height: 0.5,
    intensity: 1,
    radius: 2,
    enabled: true,
    showMarker: true,
    shadows: false,
    flicker: false,
  }));
}
