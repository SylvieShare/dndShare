#!/usr/bin/env python3
"""Check local wiki links, heading anchors, explicit source paths and navigation."""

import argparse
from collections import deque
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit


LINK = re.compile(r"!?\[[^\]\n]*\]\(([^)\n]+)\)")
HTML_LINK = re.compile(r"""(?:src|href)=["']([^"']+)["']""")
CODE = re.compile(chr(96) + r"([^" + chr(96) + r"\n]+)" + chr(96))
SOURCE_FILE = re.compile(
    r"(?:frontend/|internal/|scripts/|deploy/|md/|features/|shared/|src/|stores/|app/)"
    r"[A-Za-z0-9_./-]+\.(?:vue|js|mjs|css|go|md|sh|py|sql|json|png|webp|jpg|svg)"
)


def outside_fences(text):
    """Keep line numbers while excluding examples, commands and code blocks."""
    fence = None
    result = []
    for line in text.splitlines():
        marker = re.match(r"^\s*(" + chr(96) + r"{3,}|~{3,})", line)
        if marker:
            token = marker[1]
            if fence is None:
                fence = token
            elif token[0] == fence[0] and len(token) >= len(fence):
                fence = None
            result.append("")
        else:
            result.append(line if fence is None else "")
    return result


def heading_anchors(lines):
    anchors = set()
    counts = {}
    for line in lines:
        heading = re.match(r"^#{1,6} +(.+?)(?: +#+)?$", line)
        if not heading:
            continue
        title = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", heading[1])
        title = re.sub(r"<[^>]*>", "", title)
        slug = "".join(c for c in title.lower() if c.isalnum() or c in "_- ")
        slug = slug.replace(" ", "-")
        count = counts.get(slug, 0)
        counts[slug] = count + 1
        anchors.add(slug + (f"-{count}" if count else ""))
    anchors.update(
        match[1] for line in lines
        for match in re.finditer(r"""(?:id|name)=["']([^"']+)["']""", line)
    )
    return anchors


def local_target(raw):
    # A Markdown destination may have an optional title or be enclosed in <>.
    target = raw[1:raw.index(">")] if raw.startswith("<") else raw.split()[0]
    parsed = urlsplit(target)
    if parsed.scheme or parsed.netloc:
        return None
    return unquote(parsed.path), unquote(parsed.fragment)


def check(root):
    wiki = root / "md"
    pages = sorted(wiki.rglob("*.md"))
    documents = pages + [
        root / name for name in ("README.md", "AGENTS.md", "CLAUDE.md")
        if (root / name).exists()
    ]
    lines = {p.resolve(): outside_fences(p.read_text()) for p in documents}
    anchors = {p: heading_anchors(text) for p, text in lines.items()}
    graph = {p.resolve(): set() for p in pages}
    failures = []
    links_checked = paths_checked = 0

    def fail(page, number, message):
        failures.append(f"{page.relative_to(root)}:{number}: {message}")

    for page in documents:
        for number, line in enumerate(lines[page.resolve()], 1):
            targets = [m[1].strip() for m in LINK.finditer(line)]
            targets.extend(m[1] for m in HTML_LINK.finditer(line))
            for raw in targets:
                target = local_target(raw)
                if target is None:
                    continue
                file, fragment = target
                dest = (page.parent / file).resolve() if file else page.resolve()
                links_checked += 1
                if not dest.exists():
                    fail(page, number, f"missing link target: {raw}")
                    continue
                if dest in graph and page.resolve() in graph:
                    graph[page.resolve()].add(dest)
                if fragment and dest.suffix == ".md":
                    if dest not in anchors:
                        anchors[dest] = heading_anchors(outside_fences(dest.read_text()))
                    if fragment not in anchors[dest]:
                        fail(page, number, f"missing heading anchor: {raw}")
            for match in CODE.finditer(line):
                name = match[1]
                if not SOURCE_FILE.fullmatch(name):
                    continue
                candidates = [root / name]
                if name.startswith(("features/", "shared/", "stores/", "app/")):
                    candidates.append(root / "frontend/src" / name)
                if name.startswith("src/"):
                    candidates.append(root / "frontend" / name)
                paths_checked += 1
                if not any(path.is_file() for path in candidates):
                    fail(page, number, f"missing source file: {name}")

    entry = (wiki / "README.md").resolve()
    if entry not in graph:
        failures.append("md/README.md: missing wiki entry point")
    else:
        visited = set()
        pending = deque([entry])
        while pending:
            page = pending.popleft()
            if page in visited:
                continue
            visited.add(page)
            pending.extend(graph[page] - visited)
        for page in sorted(set(graph) - visited):
            failures.append(f"{page.relative_to(root)}: unreachable from md/README.md")

    for failure in failures:
        print(failure)
    if failures:
        print(f"Wiki check failed: {len(failures)} issue(s).")
        return 1
    print(
        f"Wiki check passed: {len(pages)} pages, {links_checked} local links, "
        f"{paths_checked} explicit source paths."
    )
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    args = parser.parse_args()
    return check(args.root.resolve())


if __name__ == "__main__":
    raise SystemExit(main())
