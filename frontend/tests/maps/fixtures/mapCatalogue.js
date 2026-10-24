import {documentMutationFixture} from './documentMutations'
export function mapCatalogueFixture(source, params, previews) {
  const maps = [source];
  const mutate=documentMutationFixture(['name','document']);
  if (params.has("tagsExample"))
    maps.push(
      {
        ...structuredClone(source),
        id: "forest-map",
        name: "Лесная поляна",
        document: {
          ...structuredClone(source.document),
          tags: ["лес", "улица"],
        },
      },
      {
        ...structuredClone(source),
        id: "forest-dungeon",
        name: "Заброшенный храм",
        document: {
          ...structuredClone(source.document),
          tags: ["лес", "подземелье"],
        },
      },
    );
  if (params.has("catalogueExample"))
    maps.push({
      ...structuredClone(source),
      id: "catalogue-map",
      name: "Зал алхимика",
      author: "architect",
      owned: false,
      publishedAt: "2026-10-01T12:00:00Z",
      subscribed: false,
      rating: 4,
      ratingCount: 2,
      myRating: 0,
    });
  const response = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  function find(id) {
    return window.lastSaved?.id === id
      ? window.lastSaved
      : maps.find((m) => m.id === id);
  }
  function decorate(map) {
    return previews.decorate({
      ...map,
      owned: map.owned ?? true,
      publishedAt: map.publishedAt || null,
      author: map.author || "tester",
      subscribed: !!map.subscribed,
      rating: map.rating || 0,
      ratingCount: map.ratingCount || 0,
      myRating: map.myRating || 0,
    });
  }
  function summary(map) {
    const { document, ...meta } = map;
    return {
      ...meta,
      width: document.width,
      height: document.height,
      tileCount: document.tiles.length,
      objectCount: document.objects.length,
      tags: document.tags,
    };
  }
  async function handle(rawUrl, options) {
    const url = new URL(rawUrl, location.origin),
      path = url.pathname,
      method = options.method || "GET";
    if (path.startsWith("/api/maps/models")) return null;
    if (path === "/api/maps" && method === "GET") {
      const scope = url.searchParams.get("scope") || "own";
      const all = [...maps];
      if (
        window.lastSaved?.id &&
        !all.some((m) => m.id === window.lastSaved.id)
      )
        all.push(window.lastSaved);
      const records = await Promise.all(all.map((m) => decorate(find(m.id))));
      return response(
        records
          .filter((m) =>
            scope === "own"
              ? m.owned
              : scope === "subscriptions"
                ? m.subscribed
                : !!m.publishedAt,
          )
          .map(summary),
      );
    }
    const changes=path.match(/^\/api\/maps\/([^/]+)\/changes$/)
    if(changes){const map=find(changes[1]);if(window.concurrentMapName){map.name=window.concurrentMapName;map.revision++;window.concurrentMapName=''};return response({fromVersion:Number(url.searchParams.get('after')),version:map.revision,data:{name:map.name,document:map.document},metadata:await decorate(map)})}
    if(method==='PATCH' && /^\/api\/maps\/[^/]+$/.test(path)) {
      const id=path.split('/')[3],map=find(id)
      if(!map)return response({},404)
      const packet=JSON.parse(options.body)
      window.requests.push({url:path,data:packet})
      const result=mutate(map,packet)
      if(result.record)window.lastSaved=result.record
      return response(result.response,result.status||200)
    }
    let match = path.match(/^\/api\/maps\/(?:subscriptions|ratings)\/([^/]+)$/);
    if (match) {
      const map = find(match[1]);
      if (!map || !map.publishedAt || map.owned !== false)
        return response({}, 404);
      const data = options.body ? JSON.parse(options.body) : null;
      if (path.includes("/subscriptions/")) map.subscribed = method === "PUT";
      else {
        map.myRating = method === "DELETE" ? 0 : data.rating;
        map.ratingCount = 2 + Number(!!map.myRating);
        map.rating = (8 + map.myRating) / map.ratingCount;
      }
      window.requests.push({ url: path, data });
      return response(await decorate(map));
    }
    match = path.match(/^\/api\/maps\/([^/]+)(?:\/(publish|copy))?$/);
    if (!match) return null;
    const map = find(match[1]);
    if (!map) return response({}, 404);
    if (method === "GET" && !match[2]) return response(await decorate(map));
    if (method !== "POST" || !match[2]) return null;
    const data = options.body ? JSON.parse(options.body) : null;
    window.requests.push({ url: path, data });
    if (match[2] === "publish") {
      if (data.revision !== map.revision)
        return response({ desc: "Карта изменена в другой вкладке" }, 409);
      map.publishedAt = new Date().toISOString();
      map.revision++;
      return response(await decorate(map));
    }
    if (map.owned === false && !map.subscribed)
      return response({ desc: "Подпишитесь на карту" }, 403);
    const copy = {
      ...structuredClone(map),
      id: "test-copy",
      name: map.name + " · копия",
      owned: true,
      subscribed: false,
      publishedAt: null,
      revision: 1,
    };
    maps.push(copy);
    window.lastSaved = copy;
    return response(await decorate(copy), 201);
  }
  return { handle, find };
}
