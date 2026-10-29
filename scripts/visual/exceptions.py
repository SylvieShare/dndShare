"""Validate human-supplied exception metadata; this never grants an approval."""
from datetime import date
import json
from pathlib import Path
import re

FORMATS = {"phone", "tablet", "wide"}
FEATURE_STATES = {
    "handbook": {"collections", "menu", "list", "record"},
    "forms": {"list", "record", "character-menu", "sheet-stat-editor"},
    "weapons": {"sheet-weapons", "sheet-magic"},
}


def read_exceptions(path):
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"Duplicate exception registry JSON key: {key}")
            result[key] = value
        return result
    return validate_exceptions(json.loads(Path(path).read_text(encoding="utf-8"), object_pairs_hook=unique_object))


def exact_keys(value, keys, location):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise ValueError(f"{location} requires exactly: {', '.join(sorted(keys))}")


def nonempty(value, location):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{location} must be a nonempty string")


def subset(value, allowed, location):
    if (not isinstance(value, list) or not value or
            any(not isinstance(entry, str) or entry not in allowed for entry in value) or
            len(set(value)) != len(value)):
        raise ValueError(f"{location} must be a nonempty unique subset of {sorted(allowed)}")


def validate_exceptions(document):
    exact_keys(document, {"schemaVersion", "exceptions"}, "Exception registry")
    if type(document["schemaVersion"]) is not int or document["schemaVersion"] != 1:
        raise ValueError("Exception registry schemaVersion must be 1")
    if not isinstance(document["exceptions"], list):
        raise ValueError("Exception registry exceptions must be an array")
    identifiers = set()
    for index, entry in enumerate(document["exceptions"]):
        location = f"exceptions[{index}]"
        exact_keys(entry, {"id", "feature", "formats", "states", "difference", "reason", "approval"}, location)
        identifier = entry["id"]
        if not isinstance(identifier, str) or not re.fullmatch(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*", identifier):
            raise ValueError(f"{location}.id must be a lowercase kebab identifier")
        if identifier in identifiers:
            raise ValueError(f"Duplicate exception id: {identifier}")
        identifiers.add(identifier)
        if entry["feature"] not in FEATURE_STATES:
            raise ValueError(f"{location}.feature must be one of {sorted(FEATURE_STATES)}")
        subset(entry["formats"], FORMATS, location + ".formats")
        subset(entry["states"], FEATURE_STATES[entry["feature"]], location + ".states")
        nonempty(entry["difference"], location + ".difference")
        if not re.search(r"[А-Яа-яЁё]", entry["difference"]):
            raise ValueError(f"{location}.difference requires a Russian description")
        nonempty(entry["reason"], location + ".reason")
        approval = entry["approval"]
        exact_keys(approval, {"by", "reference", "date"}, location + ".approval")
        for key in ("by", "reference"):
            nonempty(approval[key], location + ".approval." + key)
        date_text = approval["date"]
        if not isinstance(date_text, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_text):
            raise ValueError(f"{location}.approval.date must be YYYY-MM-DD")
        try:
            date.fromisoformat(date_text)
        except ValueError as error:
            raise ValueError(f"{location}.approval.date is not a valid calendar date") from error
    return document
