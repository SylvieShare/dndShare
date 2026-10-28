#!/usr/bin/env python3
"""Test-binary child: validate live fixture, capture both clients, save evidence."""
import argparse
import hashlib
import http.cookiejar
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import urllib.parse
import urllib.request

from adb import Emulator
from android import capture_android

ROOT = Path(__file__).resolve().parents[2]


def fetch(url, opener=None, data=None):
    request = urllib.request.Request(url, data=json.dumps(data).encode() if data else None,
                                     headers={"Content-Type": "application/json"})
    open_url = opener.open if opener else urllib.request.urlopen
    with open_url(request, timeout=20) as response:
        return json.load(response)


def validate_fixture(url, fixture):
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    auth = fetch(url + "/api/user/auth", opener, {key: fixture[key] for key in ("login", "password")})
    if not auth.get("auth"):
        raise AssertionError("Fixture login failed")
    context = fetch(url + "/api/user/checkAuth", opener)["user"]["gameContext"]
    if context["sourceVersionId"] != fixture["edition"]["id"]:
        raise AssertionError("Fixture game edition mismatch")
    types = fetch(url + "/api/item-types?sourceId=1&sourceVersionId=1", opener)["types"]
    expected = {entry["id"]: (entry["name"], entry["count"]) for entry in fixture["types"]}
    actual = {entry["id"]: (entry["name"], entry["countItems"]) for entry in types}
    if expected != actual:
        raise AssertionError(f"Fixture type/count mismatch: {actual} != {expected}")
    # Read the complete native paging contract and compare each item with REST.
    entries, metadata, cursor = [], None, None
    for _ in range(20):
        query = "sourceId=1&limit=200" + ("&cursor=" + urllib.parse.quote(cursor) if cursor else "")
        page = fetch(url + "/api/handbook/sync?" + query, opener)
        metadata = page.get("metadata", metadata)
        entries.extend(page["entries"])
        if not page["hasMore"]:
            break
        cursor = page["nextCursor"]
    else:
        raise AssertionError("Native fixture sync did not terminate")
    if len(entries) != fixture["totalRecords"] or any(entry.get("deleted") for entry in entries):
        raise AssertionError("Native fixture must contain the complete clean record set")
    by_id = {entry["id"]: entry["item"] for entry in entries}
    native_types = {entry["id"]: entry for entry in metadata["types"]}
    for type_ in types:
        for key in ("name", "fields", "iconImageUrl", "coverImageUrl"):
            if type_.get(key) != native_types[type_["id"]].get(key):
                raise AssertionError(f"REST/native metadata mismatch: {type_['id']} {key}")
    for type_ in fixture["types"]:
        items = fetch(url + f"/api/items?typeId={type_['id']}&sourceVersionId=1&limit=250", opener)["items"]
        for item in items:
            native = by_id[item["id"]]
            for key in ("name", "typeId", "data", "coverImageUrl", "iconImageUrl"):
                if item.get(key) != native.get(key):
                    raise AssertionError(f"REST/native mismatch in record {item['id']}: {key}")
    record = by_id[fixture["recordID"]]
    if record["name"] != fixture["recordName"] or fixture["description"] not in record["data"]["description"]:
        raise AssertionError("Fixture target record mismatch")
    canonical = json.dumps({"entries": entries, "metadata": metadata}, sort_keys=True, ensure_ascii=False).encode()
    characters = []
    for character in fixture.get("characters", []):
        sheet = fetch(url + "/api/char/" + character["uuid"], opener)
        if sheet["templateName"] != character["templateName"]:
            raise AssertionError("Wrong character system in the shared fixture")
        characters.append({"uuid": character["uuid"], "templateName": sheet["templateName"],
                           "data": sheet["data"]})
    character_hash = hashlib.sha256(json.dumps(characters, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return {"recordCount": len(entries), "restAndNativeMatch": True,
            "charactersHash": character_hash,
            "servedDataHash": hashlib.sha256(canonical).hexdigest(), "gameContext": context,
            "nativeSyncPages": (len(entries) + 199) // 200}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    args = parser.parse_args()
    if os.environ.get("DNDSHARE_UI_REVIEW") != "1":
        parser.error("Run through scripts/visual/compare.py and TestUIReviewPostgres")
    def interrupted(signum, frame):
        raise KeyboardInterrupt(f"Capture interrupted by signal {signum}")
    signal.signal(signal.SIGTERM, interrupted)
    output = Path(os.environ["DNDSHARE_UI_REVIEW_OUTPUT"])
    prepared = ROOT / ".ui-workspace.json"
    if prepared.is_file():
        config_path = json.loads(prepared.read_text())["config"]
        config = json.loads(Path(config_path).read_text())
        os.environ.setdefault("DNDSHARE_POWERSHELL", config["powershell"])
        os.environ.setdefault("ANDROID_HOME", config["android_home"])
    matrix = json.loads((ROOT / "scripts/visual/matrix.json").read_text())
    fixture = fetch(args.url + "/__test/fixture")
    evidence = validate_fixture(args.url, fixture)
    (output / "fixture.json").write_text(json.dumps(fixture, ensure_ascii=False, indent=2))
    (output / "api-evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2))
    device = Emulator(os.environ["DNDSHARE_ANDROID_SERIAL"], output / "android")
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    selected_states = json.loads(os.environ.get('DNDSHARE_REVIEW_STATES', '[]'))
    env = dict(os.environ, DNDSHARE_REVIEW_WEB_PORT=str(port), DNDSHARE_REVIEW_API=args.url)
    if selected_states:
        matrix['states'] = [entry for entry in matrix['states'] if (entry['name'] if isinstance(entry, dict) else entry) in selected_states]
    with device.configured(urllib.parse.urlparse(args.url).port):
        if os.environ.get('DNDSHARE_REVIEW_SCENARIO') in {'form-lifecycle', 'character-actions', 'character-session', 'character-media', 'character-weapons', 'character-inventory', 'character-identity', 'character-spells', 'character-creation'}:
            scenario = os.environ['DNDSHARE_REVIEW_SCENARIO']
            if scenario == 'form-lifecycle':
                from scenario import form_lifecycle
                form_lifecycle(device, ROOT, args.url, output, fixture, lambda: fetch(args.url + '/__test/stats'))
            elif scenario == 'character-actions':
                from character_actions import character_actions
                character_actions(device, ROOT, args.url, output, fixture, lambda: fetch(args.url + '/__test/stats'))
            elif scenario == 'character-creation':
                from character_creation import creation_actions
                creation_actions(device, ROOT, args.url, output, fixture)
            elif scenario == 'character-spells':
                from character_spells import spell_actions
                spell_actions(device, ROOT, args.url, output, fixture, lambda: fetch(args.url + '/__test/stats'))
            elif scenario == 'character-identity':
                from character_identity import identity_actions
                identity_actions(device, ROOT, args.url, output, fixture)
            elif scenario == 'character-inventory':
                from character_inventory import inventory_actions
                inventory_actions(device, ROOT, args.url, output, fixture, lambda: fetch(args.url + '/__test/stats'))
            elif scenario == 'character-weapons':
                from character_weapons import weapon_actions
                weapon_actions(device, ROOT, args.url, output, fixture, lambda: fetch(args.url + '/__test/stats'))
            elif scenario == 'character-media':
                from character_media import media_actions
                media_actions(device, ROOT, args.url, output, fixture, lambda: fetch(args.url + '/__test/stats'))
            else:
                from character_session import session_actions
                session_actions(device, ROOT, args.url, output, fixture, lambda: fetch(args.url + '/__test/stats'))
            final = validate_fixture(args.url, fixture)
            if final != evidence:
                raise AssertionError('Scenario changed the shared fixture')
            (output / 'scenario.json').write_text(json.dumps({'scenario': scenario, 'passed': True, 'realAPI': True, 'isolatedPostgres': True, 'fixtureRestored': True}, indent=2))
            return
        print("Capturing WEB with package-lock Playwright Chromium", flush=True)
        with (output / "web-capture.log").open("wb") as log:
            subprocess.run(["node", "node_modules/@playwright/test/cli.js", "test", "-c",
                            "playwright.review.config.js"], cwd=ROOT / "frontend", env=env,
                           stdout=log, stderr=subprocess.STDOUT, check=True, timeout=600)
        capture_android(device, ROOT, args.url, output / "android", matrix, fixture,
                        lambda: fetch(args.url + "/__test/stats"))
    final = validate_fixture(args.url, fixture)
    if final != evidence:
        raise AssertionError("The shared API fixture changed during capture")
    (output / "api-stats.json").write_text(json.dumps(fetch(args.url + "/__test/stats"), indent=2))
    # Do not leak a working endpoint into a report consumed after test cleanup.
    (output / "capture.json").write_text(json.dumps({"sameAPI": True, "isolatedPostgres": True,
                                                   "fixtureVerifiedBeforeAndAfter": True}, indent=2))


if __name__ == "__main__":
    main()
