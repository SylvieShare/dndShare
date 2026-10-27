"""Explicit local source refinements, with the native service export preserved."""

import json
from pathlib import Path
from model_build_queue import native_directory, file_hash


def source_file(entry, folder):
    return (
        folder / "source-repair/repaired-source.glb"
        if entry.get("sourceRepair")
        else native_directory(folder, entry.get("nativeAttempt", 1))
        / "generated-original.glb"
    )


def geometry_source(entry, folder):
    if not entry.get("geometryBaseline"):
        return source_file(entry, folder)
    name = Path(entry["geometryBaseline"])
    if name.is_absolute() or ".." in name.parts:
        raise ValueError("Geometry baseline must be inside the model folder")
    target = folder / name
    if not target.resolve().is_relative_to(folder.resolve()):
        raise ValueError("Geometry baseline must be inside the model folder")
    return target


def refine_source(entry, folder, stage, execute, blender, scripts, script_hash):
    if not entry.get("sourceRepair"):
        return
    native = (
        native_directory(folder, entry.get("nativeAttempt", 1))
        / "generated-original.glb"
    )
    out = folder / "source-repair"

    def action():
        execute(
            [
                blender,
                "--background",
                "--factory-startup",
                "--python-exit-code",
                "1",
                "--python",
                scripts / "repair-native-source.py",
                "--",
                native,
                out,
                "--recipe",
                folder / "recipe.json",
            ],
            folder / "logs/source-repair.log",
        )
        return (
            [
                out / name
                for name in [
                    "repaired-source.glb",
                    "repair.blend",
                    "repair-report.json",
                ]
            ]
            + list(out.glob("colour-*.png"))
            + list(out.glob("orm-*.png"))
        )

    stage(
        "source-repair",
        {
            "native": file_hash(native),
            "settings": entry["sourceRepair"],
            "calibration": json.loads((folder / "recipe.json").read_text()).get(
                "calibration"
            ),
            "scripts": script_hash(
                "repair-native-source.py", "repair_source_art.py", "miniature_scene.py"
            ),
        },
        action,
    )
