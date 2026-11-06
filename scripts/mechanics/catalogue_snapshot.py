"""Read the public catalogue without altering records. Capture schema and dictionaries together."""
import json
from urllib.parse import urlencode
from urllib.request import urlopen


def referenced_items(base_url, ids):
    found = []
    for start in range(0, len(ids), 80):
        query = urlencode({"ids": ",".join(ids[start:start + 80])})
        with urlopen(f"{base_url.rstrip('/')}/api/items/by-ids?{query}", timeout=45) as response:
            found.extend(json.load(response)["items"])
    return found


def download(base_url):
    def get(path, **query):
        url = base_url.rstrip("/") + "/api/" + path + "?" + urlencode(query)
        with urlopen(url, timeout=45) as response:
            return json.load(response)

    types = get("item-types")["types"]
    items = []
    for item_type in types:
        seen = set()
        while True:
            page = get("items", typeId=item_type["id"], limit=500, offset=len(seen))
            rows = page["items"]
            if not rows:
                break
            if len({row["id"] for row in rows} - seen) != len(rows):
                raise ValueError(f"Catalogue changed during pagination of type {item_type['id']}, retry")
            seen.update(row["id"] for row in rows)
            items.extend(rows)
        if len(seen) != item_type["countItems"]:
            raise ValueError(f"Count changed for type {item_type['id']}, retry the snapshot")
    suggest_types = get("suggest/types")["items"]
    ids = ",".join(str(t["id"]) for t in suggest_types)
    suggests = get("suggest/batch", typeIds=ids)["items"]
    return {"types": types, "items": items, "suggests": suggests}
