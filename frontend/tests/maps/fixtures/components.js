export function componentExample(catalogue, source, floorId) {
  catalogue.find((m) => m.id === floorId).behaviour = {
    revision: 1,
    transitions: [],
    defaultFlags: [{ key: "burning", name: "Горит", enabled: true }],
    defaultLights: [
      {
        key: "lamp",
        name: "Свет",
        kind: "torch",
        color: "#ffb04a",
        position: [0.5, 0.5, 1],
        intensity: 8,
        radius: 4,
        enabled: true,
        flicker: true,
        flagKey: "burning",
      },
    ],
    defaultEffects: [
      {
        key: "fire",
        name: "Пламя",
        kind: "fire",
        color: "#ffb04a",
        position: [0.5, 0.5, 0.6],
        size: [0.22, 0.35],
        strength: 0.7,
        enabled: true,
        flagKey: "burning",
      },
    ],
  };
  source.document.tiles = [
    { id: "torch", modelId: floorId, x: 4, y: 4, rotation: 0, level: 0 },
  ];
  source.document.objects = [];
  source.document.zones = [];
  source.document.areas = [];
  source.document.flags = [];
  source.document.effects = [];
  source.document.lightingEnabled = true;
  source.document.sun = { enabled: false, angle: 225, elevation: 45 };
}
