export function groupExamples(catalogue) {
  const floor = catalogue.find((m) => m.sourceCode === "LC-007");
  catalogue.push({
    ...floor,
    id: "80808080-8080-4080-8080-808080808080",
    definitionId: "LC-008",
    sourceCode: "LC-008",
    sourceName: "Ground 2",
    name: "Пол 2",
    code: floor.code,
  });
  const wall = catalogue.find((m) => m.sourceCode === "LC-001");
  wall.behaviour = {
    ...wall.behaviour,
    defaultLights: [
      {
        key: "lamp",
        name: "Факел",
        kind: "torch",
        color: "#ffc36a",
        position: [0.5, 0.5, 1],
        intensity: 8,
        radius: 4,
        enabled: true,
        flicker: false,
      },
    ],
  };
  catalogue.push({
    ...wall,
    id: "81818181-8181-4181-8181-818181818181",
    definitionId: "LC-002",
    sourceCode: "LC-002",
    sourceName: "Wall 2",
    name: "Стена 2",
    code: wall.code,
    behaviour: { ...wall.behaviour, defaultLights: [] },
  });
  const chest = catalogue.find((m) => m.tileType === "object");
  chest.code = "MA-chest";
  catalogue.push({
    ...chest,
    id: "82828282-8282-4282-8282-828282828282",
    definitionId: "MA-Chest-Open",
    sourceCode: "MA-Chest-Open",
    sourceName: "Chest open",
    name: "Открытый сундук",
    code: "MA-chest",
  });
}
