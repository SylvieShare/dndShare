export function decalFixture() {
  const images = [];
  return (endpoint, options) => {
    if (endpoint !== "/api/maps/decals") return;
    const json = value => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
    if (options.method !== "POST") return json(images);
    const form = options.body, file = form.get("file");
    const image = { id: crypto.randomUUID(), name: form.get("name"), category: form.get("category"), imageUrl: URL.createObjectURL(file) };
    images.unshift(image); return json(image);
  };
}
