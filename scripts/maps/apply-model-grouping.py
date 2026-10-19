#!/usr/bin/env python3
"""Apply one reviewed grouping plan through MCP; no asset bytes or credentials are logged."""
import argparse
import json
import os
import urllib.request


def tool(name, args):
    token = os.environ.get("MCP_AUTH_TOKEN")
    if not token:
        raise RuntimeError("MCP_AUTH_TOKEN is required")
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": name, "arguments": args}}).encode()
    request = urllib.request.Request(os.environ.get("DNDSHARE_MCP_URL", "https://dndshare.ru/mcp"), data=body, headers={"Content-Type": "application/json", "Authorization": "Bearer " + token})
    with urllib.request.urlopen(request, timeout=90) as response:
        data = json.load(response)
    result = data.get("result", {})
    if data.get("error") or result.get("isError"):
        raise RuntimeError("MCP grouping request rejected")
    if "structuredContent" in result:
        return result["structuredContent"]["result"]
    return json.loads(next(item["text"] for item in result["content"] if item["type"] == "text"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    with open(args.plan) as source:
        plan = json.load(source)
    if not isinstance(plan, list) or not 1 <= len(plan) <= 1000:
        raise RuntimeError("Expected a reviewed plan with 1..1000 models")
    before = {model["definitionId"]: model for model in tool("map_tile_models_list", {})}
    for entry in plan:
        model = before.get(entry["definitionId"])
        if not model:
            raise RuntimeError("Missing model: " + entry["definitionId"])
        current = (model["code"], model.get("variantCode", ""))
        expected = (entry["expectedCode"], entry["expectedVariantCode"])
        target = (entry["code"], entry["variantCode"])
        if current not in (expected, target):
            raise RuntimeError("Grouping changed since review: " + entry["definitionId"])
    if not args.apply:
        print(json.dumps({"reviewed": len(plan), "wouldUpdate": sum((before[e["definitionId"]]["code"], before[e["definitionId"]].get("variantCode", "")) != (e["code"], e["variantCode"]) for e in plan)}))
        return
    tool("map_tile_model_grouping_update", {"models": plan})
    after = {model["definitionId"]: model for model in tool("map_tile_models_list", {})}
    for entry in plan:
        model = after[entry["definitionId"]]
        if (model["code"], model["variantCode"]) != (entry["code"], entry["variantCode"]):
            raise RuntimeError("Grouping verification failed: " + entry["definitionId"])
    other_changes = [e["definitionId"] for e in plan if {k: v for k, v in before[e["definitionId"]].items() if k not in ("code", "variantCode")} != {k: v for k, v in after[e["definitionId"]].items() if k not in ("code", "variantCode")}]
    print(json.dumps({"verified": len(plan), "sections": len({(after[e["definitionId"]]["collection"], e["code"]) for e in plan}), "variantFamilies": len({(after[e["definitionId"]]["collection"], e["code"], e["variantCode"]) for e in plan}), "concurrentOtherChanges": other_changes}))


if __name__ == "__main__":
    main()
