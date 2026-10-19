"""Apply reviewed catalogue labels through MCP, without touching model resources."""
import argparse
import json
import os
import urllib.request


def call(name, arguments):
    request = urllib.request.Request(
        os.environ.get("DNDSHARE_MCP_URL", "https://dndshare.ru/mcp"),
        data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": name, "arguments": arguments}}).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + os.environ["MCP_AUTH_TOKEN"]},
    )
    with urllib.request.urlopen(request, timeout=150) as response:
        data = json.load(response)
    if data.get("error") or data.get("result", {}).get("isError"):
        raise RuntimeError("MCP catalogue operation rejected: " + json.dumps(data, ensure_ascii=False))
    result = data["result"]
    if "result" in result.get("structuredContent", {}):
        return result["structuredContent"]["result"]
    return json.loads(next(block["text"] for block in result["content"] if block["type"] == "text"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("plan")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    with open(args.plan) as file:
        plan = json.load(file)
    before = {m["definitionId"]: m for m in call("map_tile_models_list", {})}
    for change in plan["models"]:
        current = {key: before[change["definitionId"]][key] for key in change["expected"]}
        target = {key: change[key] for key in change["expected"]}
        if current not in (change["expected"], target):
            raise RuntimeError("Catalogue changed: " + change["definitionId"])
    for group in plan["groups"]:
        members = [m for m in before.values() if (m["collection"], m["code"]) == (group["collection"], group["code"])]
        if not members or any((m["groupName"], m["groupNameEn"]) not in ((group["expectedName"], group["expectedNameEn"]), (group["name"], group["nameEn"])) for m in members):
            raise RuntimeError("Group changed: " + group["code"])
    if not args.apply:
        print(json.dumps({"reviewedModels": len(plan["models"]), "reviewedGroups": len(plan["groups"])}))
        return
    call("map_tile_model_catalogue_update", plan)
    after = {m["definitionId"]: m for m in call("map_tile_models_list", {})}
    for change in plan["models"]:
        model = after[change["definitionId"]]
        if any(model[key] != change[key] for key in ("name", "nameEn", "category", "code")):
            raise RuntimeError("Catalogue verification failed: " + change["definitionId"])
    for group in plan["groups"]:
        if any((m["groupName"], m["groupNameEn"]) != (group["name"], group["nameEn"]) for m in after.values() if (m["collection"], m["code"]) == (group["collection"], group["code"])):
            raise RuntimeError("Group verification failed: " + group["code"])
    fields = {"name", "nameEn", "category", "groupName", "groupNameEn"}
    concurrent = [m for m in before if m in after and {k: v for k, v in before[m].items() if k not in fields} != {k: v for k, v in after[m].items() if k not in fields}]
    print(json.dumps({"verifiedModels": len(plan["models"]), "verifiedGroups": len(plan["groups"]), "concurrentOtherChanges": concurrent}))


if __name__ == "__main__":
    main()
