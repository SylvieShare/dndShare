#!/usr/bin/env python3
"""Generate one textured creature using the public official TRELLIS.2 demo."""
import argparse
import getpass
import json
import shutil
import time
from pathlib import Path

from gradio_client import Client, handle_file
from huggingface_hub import HfApi


def run(client, endpoint, **arguments):
    print(f"Starting {endpoint}", flush=True)
    job = client.submit(api_name=endpoint, **arguments)
    previous = None
    while not job.done():
        status = job.status()
        value = (str(status.code), status.rank, status.queue_size)
        if value != previous:
            print(f"{endpoint}: {value}", flush=True)
            previous = value
        time.sleep(5)
    return job.result()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--resolution", choices=["512", "1024", "1536"], default="1024")
    parser.add_argument("--seed", type=int, default=1635)
    parser.add_argument("--token-stdin", action="store_true", help="Read an authorized token with hidden terminal input; never persist it")
    parser.add_argument("--views-only", action="store_true", help="Save generated views for local reconstruction; skip remote GLB extraction")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    token = getpass.getpass('HF token (not saved): ') if args.token_stdin else False
    if token:
        account = HfApi(token=token).whoami()
        if account.get('isPro') or account.get('type') != 'user':
            raise RuntimeError('This experiment only uses free personal quota; paid accounts require a separate spending limit')
        print('Authenticated free personal account; token stays in memory', flush=True)
    client = Client("microsoft/TRELLIS.2", token=token, verbose=False, analytics_enabled=False,
                    download_files=str(args.output / "downloads"))
    run(client, "/start_session")
    processed = run(client, "/preprocess_image", input=handle_file(str(args.image.resolve())))
    print("Reference preprocessing complete", flush=True)
    if isinstance(processed, dict):
        processed = processed["path"]
    shutil.copy2(processed, args.output / "trellis-input.png")
    preview = run(client, "/image_to_3d", image=handle_file(processed),
                  seed=args.seed, resolution=args.resolution)
    (args.output / "generation-preview.html").write_text(preview)
    if args.views_only:
        metadata={"provider":"microsoft/TRELLIS.2", "seed":args.seed,
                  "resolution":args.resolution, "originalMeshExported":False,
                  "viewsSaved":True}
        (args.output / "generation.json").write_text(json.dumps(metadata,indent=2)+"\n")
        print(json.dumps(metadata),flush=True)
        return
    outputs = run(client, "/extract_glb", decimation_target=300000, texture_size=2048)
    path = outputs[0]["path"] if isinstance(outputs[0], dict) else outputs[0]
    target = args.output / "generated-original.glb"
    shutil.copy2(path, target)
    metadata = {"provider": "microsoft/TRELLIS.2", "seed": args.seed,
                "resolution": args.resolution, "decimationTarget": 300000,
                "textureSize": 2048, "bytes": target.stat().st_size}
    (args.output / "generation.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata), flush=True)


if __name__ == "__main__":
    main()
