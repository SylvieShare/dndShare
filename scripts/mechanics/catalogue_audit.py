"""Check sheet mechanics against the published schema, dictionaries and their actual owners."""
import argparse
from collections import Counter
import json
from pathlib import Path
import re

from catalogue_snapshot import download, referenced_items

ROOT = Path(__file__).resolve().parents[2]
DERIVED_FIXTURE = ROOT / "native/fixtures/game-mechanics/derived-rules.json"
IMPORT_METADATA = {"edition_key", "import_fingerprint", "rules_source"}
ROLL_SCOPES = {"attack", "ability_check", "skill_check", "saving_throw", "initiative", "tool"}
# Values are names of collections on the declared source item. Omitting a reference is valid.
LOCAL_KEYS = {
    "choice_key": "choices", "depends_on_choice": "choices", "casting_ability_choice_key": "choices",
    "unique_choice_key": "choices", "ability_choice_key": "choices", "weapon_damage_key": "weapon_damage",
    "requires_damage_key": "weapon_damage", "status_effect_key": "status_effects", "use_key": "confirmed_uses",
    "resource_key": "use_resources", "spell_effect_key": "status_effects",
}


def ref_id(value):
    return str(value.get("id", "") if isinstance(value, dict) else value)


def audit(snapshot):
    schemas = {t["id"]: t["fields"] for t in snapshot["types"]}
    catalogue = {str(i["id"]): i for i in snapshot["items"] + snapshot.get("referenced_items", []) if not i.get("deleted")}
    parents = {t["id"]: t.get("parentTypeId") for t in snapshot["types"]}
    dictionaries = {str(k): {str(v["id"]) for v in rows} for k, rows in snapshot["suggests"].items()}
    action_codes = {row.get("code") for row in snapshot["suggests"].get("24", [])}
    status_codes = {i["data"].get("code") for i in catalogue.values() if i["typeId"] == 15}
    resource_pools = {r["key"] for i in catalogue.values() for r in i["data"].get("class_resources") or [] if r.get("key")}
    cases = json.loads(DERIVED_FIXTURE.read_text(encoding="utf8"))
    known_kinds = {r["kind"] for c in cases for i in c["items"] for r in i["data"].get("derived_effects", [])}
    issues = []
    totals = Counter()

    def check(item, path, code, value):
        issues.append({"item": item["id"], "name": item["name"], "path": path, "code": code, "value": value})

    def linked(item, path, value, owner, collection):
        totals["key_references"] += 1
        keys = {str(r.get("key")) for r in (owner or {}).get("data", {}).get(collection) or [] if isinstance(r, dict)}
        if str(value) not in keys:
            check(item, path, "missing_rule_key", value)

    def reference_owner(item, values, key):
        source_field = {"resource_key": "resource_item_id", "choice_key": "source_item_id",
                        "ability_choice_key": "ability_choice_source", "spell_effect_key": "spell"}.get(key)
        source = values.get(source_field)
        return catalogue.get(ref_id(source)) if source else item

    def choice_options(choice):
        source = choice.get("source") or "inline"
        if source == "inline":
            return {str(o.get("value") or o.get("label")) for o in choice.get("options") or []}
        if source == "suggest":
            return dictionaries.get(str(choice.get("from_suggest_id")), set())
        if source == "suggest_union":
            return {f"{s['prefix']}:{v}" for s in choice.get("suggest_sources") or []
                    for v in dictionaries.get(str(s.get("suggest_id")), set())}
        return None

    def walk(item, fields, data, prefix=""):
        if not isinstance(data, dict):
            check(item, prefix, "expected_object", data)
            return
        schema = {f["key"]: f for f in fields}
        for key, value in data.items():
            if value is None or value == "" or value == [] or value == {}:
                continue
            path = prefix + key
            field = schema.get(key)
            if not field:
                if key not in IMPORT_METADATA:
                    check(item, path, "outside_editor_schema", key)
                continue
            typ = field["type"]
            if typ in {"object_array", "item_array", "suggest_array", "enum_array", "text_array"} and not isinstance(value, list):
                check(item, path, "expected_list", value)
                continue
            if typ in {"object", "object_array"}:
                rows = value if typ == "object_array" else [value]
                seen = set()
                for index, row in enumerate(rows):
                    child = f"{path}[{index}]" if typ == "object_array" else path
                    if isinstance(row, dict) and row.get("key") and typ == "object_array":
                        name = (ref_id(row.get("item")), row["key"]) if key == "application_sources" else row["key"]
                        if name in seen:
                            check(item, child + ".key", "duplicate_rule_key", name)
                        seen.add(name)
                    walk(item, field.get("fields", []), row, child + ".")
                continue
            if typ in {"item", "item_array"} or key in {"resource_item_id", "source_item_id", "ability_choice_source"}:
                for ref in value if isinstance(value, list) else [value]:
                    if ref in (None, "", 0):
                        continue
                    totals["item_references"] += 1
                    target = catalogue.get(ref_id(ref))
                    if not target:
                        check(item, path, "missing_item", ref_id(ref))
                    else:
                        allowed = field.get("item_type")
                        allowed = allowed if isinstance(allowed, list) else [allowed] if allowed else []
                        target_type = target["typeId"]
                        if allowed and target_type not in allowed and not (2 in allowed and parents.get(target_type) == 2):
                            check(item, path, "wrong_item_type", ref_id(ref))
                        if target.get("hidden"):
                            totals["references_to_hidden_items"] += 1
            if typ in {"suggest", "suggest_array"}:
                dictionary = str(field.get("suggest_id") or field.get("suggest_type_id") or field.get("suggestTypeId"))
                for ref in value if isinstance(value, list) else [value]:
                    if ref in (None, "", 0):
                        continue
                    totals["dictionary_references"] += 1
                    if ref_id(ref) not in dictionaries.get(dictionary, set()):
                        check(item, path, "missing_dictionary_entry", f"{dictionary}/{ref_id(ref)}")
            if typ in {"select", "enum_array"} and field.get("options"):
                options = {str(v["value"]) if isinstance(v, dict) else str(v) for v in field["options"]}
                for option in value if isinstance(value, list) else [value]:
                    if str(option) not in options:
                        check(item, path, "unknown_option", option)
            if path.startswith("derived_effects[") and key == "kind":
                totals["derived_rules"] += 1
                if value not in known_kinds:
                    check(item, path, "untested_derived_kind", value)
            if key == "scopes" and (path.startswith("derived_effects[") or path.startswith("roll_triggers[")):
                allowed = {"spellcasting", "concentration"} if data.get("kind") == "activity_block" else ROLL_SCOPES
                for scope in value:
                    if scope not in allowed:
                        check(item, path, "unknown_scope", scope)
            if key in LOCAL_KEYS:
                linked(item, path, value, reference_owner(item, data, key), LOCAL_KEYS[key])
            if (key == "from_suggest_id" or key == "suggest_id" and typ == "int") and str(value) not in dictionaries:
                check(item, path, "missing_dictionary", value)
            if key == "from_item_type_id" and value not in schemas:
                check(item, path, "missing_item_type", value)
            if key == "target_ids" and data.get("kind") in {"weapon_proficiency", "armor_proficiency", "tool_proficiency", "language_proficiency"}:
                dictionary = {"weapon_proficiency": "4", "armor_proficiency": "3", "tool_proficiency": "5", "language_proficiency": "6"}[data["kind"]]
                for target in value:
                    totals["dictionary_references"] += 1
                    if str(target) not in dictionaries.get(dictionary, set()):
                        check(item, path, "missing_dictionary_entry", f"{dictionary}/{target}")
            if key in {"choice_values", "choice_value_prefix"} or key == "values" and prefix.startswith("selection_requirements.choices["):
                owner = catalogue.get(ref_id(data.get("item_id"))) if key == "values" else item
                choice_key = data.get("key" if key == "values" else "choice_key")
                choice = next((c for c in (owner or {}).get("data", {}).get("choices") or [] if c.get("key") == choice_key), None)
                if not choice:
                    check(item, path, "missing_choice", choice_key)
                elif key == "choice_value_prefix":
                    if value not in {s.get("prefix") for s in choice.get("suggest_sources") or []}:
                        check(item, path, "missing_choice_prefix", value)
                else:
                    allowed = choice_options(choice)
                    for selected in value:
                        if allowed is not None and str(selected) not in allowed:
                            check(item, path, "missing_choice_option", selected)
            if key == "key" and re.fullmatch(r"selection_requirements\.choices\[\d+\]\.key", path):
                linked(item, path, value, catalogue.get(ref_id(data.get("item_id"))), "choices")
            codes = {"resource_pool_key": resource_pools, "status_effect_code": status_codes,
                     "required_status_codes": status_codes, "suggest_action_codes": action_codes}.get(key)
            if codes is not None:
                for code in value if isinstance(value, list) else [value]:
                    totals["code_references"] += 1
                    if code not in codes:
                        check(item, path, "missing_code", code)
        if prefix and "parameter_bindings" in data and data.get("effect"):
            target = catalogue.get(ref_id(data["effect"]))
            if target:
                params = {r[k] for section in ("derived_effects", "weapon_damage") for r in target["data"].get(section) or []
                          for k in ("value_parameter", "dice_count_parameter") if r.get(k)}
                for index, binding in enumerate(data["parameter_bindings"] or []):
                    if binding.get("key") and binding["key"] not in params:
                        check(item, f"{prefix}parameter_bindings[{index}].key", "unused_effect_parameter", binding["key"])

    for item in snapshot["items"]:
        if item["typeId"] == 6:  # Bestiary entries are reference targets, with their own runtime.
            continue
        totals["sheet_catalogue_items"] += 1
        if item["typeId"] not in schemas:
            check(item, "typeId", "missing_item_type", item["typeId"])
            continue
        walk(item, schemas[item["typeId"]], item["data"])
    return {"counts": dict(totals), "indexed_items": len(catalogue), "issues": issues}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--snapshot", type=Path, help="JSON with types, items and suggests")
    group.add_argument("--live", action="store_true", help="download the public catalogue")
    parser.add_argument("--base-url", default="https://dndshare.ru")
    parser.add_argument("--report", type=Path, help="write all findings as JSON")
    parser.add_argument("--save-snapshot", type=Path, help="save the exact public inputs for an offline audit")
    args = parser.parse_args()
    snapshot = download(args.base_url) if args.live else json.loads(args.snapshot.read_text(encoding="utf8"))
    report = audit(snapshot)
    if args.live:
        missing = sorted({i["value"] for i in report["issues"] if i["code"] == "missing_item" and i["value"].isdigit()})
        if missing:
            snapshot["referenced_items"] = referenced_items(args.base_url, missing)
            report = audit(snapshot)
    if args.save_snapshot:
        args.save_snapshot.parent.mkdir(parents=True, exist_ok=True)
        args.save_snapshot.write_text(json.dumps(snapshot, ensure_ascii=False), encoding="utf8")
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(report["counts"], "issues:", len(report["issues"]))
    for issue in report["issues"][:15]:
        print(issue)
    return int(bool(report["issues"]))


if __name__ == "__main__":
    raise SystemExit(main())
