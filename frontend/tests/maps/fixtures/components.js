export function componentExample(catalogue, source, floorId) {
  catalogue.find((m) => m.id === floorId).behaviour = {
    revision: 1,
    transitions: [],
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
        effect: {
          kind: "fire",
          size: [0.22, 0.35],
          strength: 0.7,
          offset: [0, 0, -0.4],
        },
      },
    ],
  };
  source.document.tiles = [
    { id: "torch", modelId: floorId, x: 4, y: 4, rotation: 0, level: 0 },
  ];
  source.document.objects = [];
  source.document.zones = [];
  source.document.areas = [];
  source.document.lightingEnabled = true;
  source.document.sun = { enabled: false, angle: 225, elevation: 45 };
}
