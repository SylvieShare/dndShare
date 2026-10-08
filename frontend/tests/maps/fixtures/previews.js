// Persist server preview metadata and bytes across browser reloads in this fixture.
export function previewFixture(catalogue, dto) {
  const prefix = "map-preview:";
  async function signature(map) {
    const doc = structuredClone(map.document);
    delete doc.tags;
    const ids = new Set([...doc.tiles, ...doc.objects].map((m) => m.modelId));
    const models = catalogue.filter((m) => ids.has(m.id));
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify([doc, models])),
    );
    return [...new Uint8Array(hash)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
  }
  async function decorate(map) {
    const sig = await signature(map);
    const stored = JSON.parse(
      sessionStorage.getItem(prefix + map.id) || "null",
    );
    return {
      ...map,
      previewSignature: sig,
      previewUrl:
        stored?.signature === sig
          ? `data:image/webp;base64,${stored.b64}`
          : undefined,
    };
  }
  async function handle(rawUrl, options) {
    const url = new URL(rawUrl, location.origin);
    const match = url.pathname.match(
      /^\/api\/maps\/([^/]+)\/(preview|preview-context)$/,
    );
    if (!match) return null;
    const [, id, kind] = match;
    const response = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    if (kind === "preview-context") {
      const maps = await (await fetch("/api/maps")).json();
      const map =
        window.lastSaved?.id === id
          ? window.lastSaved
          : maps.find((m) => m.id === id);
      if (!map) return response({}, 404);
      return response({
        document: map.document,
        models: catalogue.map(dto),
        signature: await signature(map),
      });
    }
    if (options.method === "POST") {
      const bytes = new Uint8Array(await options.body.arrayBuffer());
      const b64 = btoa(
        Array.from(bytes, (n) => String.fromCharCode(n)).join(""),
      );
      const sig = url.searchParams.get("signature");
      sessionStorage.setItem(
        prefix + id,
        JSON.stringify({ signature: sig, b64 }),
      );
      window.requests.push({
        url: url.pathname,
        data: { signature: sig, preview: true },
      });
      return response({ previewUrl: `data:image/webp;base64,${b64}` });
    }
    const saved = JSON.parse(sessionStorage.getItem(prefix + id) || "null");
    if (!saved) return response({}, 404);
    return new Response(
      Uint8Array.from(atob(saved.b64), (c) => c.charCodeAt(0)),
      { headers: { "Content-Type": "image/webp" } },
    );
  }
  return { handle, decorate };
}
