export function modelDownloadsFixture(params, bodyFor) {
  const pending = new Map();
  let automatic = false;
  window.modelTransfers = [];
  window.activeModelTransfers = 0;
  window.maxActiveModelTransfers = 0;
  window.advanceModelTransfers = (fraction = 1) => {
    for (const transfer of [...pending.values()]) transfer.send(fraction);
  };
  window.finishModelTransfers = () => {
    automatic = true;
    window.advanceModelTransfers();
  };
  return {
    sizes(id) {
      const size = bodyFor(id).byteLength;
      return { render: size, lod: size, shadow: size, preview: 0 };
    },
    response(url, id) {
      const body = bodyFor(id),
        headers = {
          "Content-Type": "model/gltf-binary",
          "Content-Length": String(body.byteLength),
        };
      if (!params.has("downloadExample") || automatic)
        return new Response(body, { headers });
      const bytes = new Uint8Array(body);
      window.modelTransfers.push(url);
      window.activeModelTransfers++;
      window.maxActiveModelTransfers = Math.max(
        window.maxActiveModelTransfers,
        window.activeModelTransfers,
      );
      let sent = 0;
      return new Response(
        new ReadableStream({
          start(controller) {
            const transfer = {
              send(fraction) {
                const end = Math.max(sent, Math.ceil(bytes.length * fraction));
                if (end > sent) controller.enqueue(bytes.slice(sent, end));
                sent = end;
                if (sent === bytes.length) {
                  pending.delete(url);
                  window.activeModelTransfers--;
                  controller.close();
                }
              },
            };
            pending.set(url, transfer);
          },
          cancel() {
            pending.delete(url);
            window.activeModelTransfers--;
          },
        }),
        { headers },
      );
    },
  };
}
export function downloadMapExample(document, catalogue) {
  document.lightingEnabled = true;
  document.tiles = catalogue.slice(0, 5).map((m, i) => ({
    id: `download-${i}`,
    modelId: m.id,
    x: i + 2,
    y: 3,
    rotation: 0,
    level: 0,
  }));
  for (const model of catalogue)
    model.shadowUrl = `/api/maps/models/${model.id}/shadow`;
}
