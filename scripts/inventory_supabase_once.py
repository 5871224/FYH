from pathlib import Path
import hashlib
import re

ROOT = Path("supabase")
SUMMARY = ROOT / "_cleanup_summary.txt"
FULL = ROOT / "_cleanup_inventory.txt"

files = sorted(
    p for p in ROOT.rglob("*")
    if p.is_file()
    and p.suffix.lower() in {".sql", ".md"}
    and p.name not in {SUMMARY.name, FULL.name}
)

records = []
for path in files:
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("utf-8", errors="replace")
    normalized = re.sub(r"\s+", " ", text).strip().lower()
    sha = hashlib.sha256(raw).hexdigest()
    norm_sha = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    lines = text.splitlines()
    sql_objects = []
    if path.suffix.lower() == ".sql":
        patterns = [
            r"(?im)^\s*create\s+(?:or\s+replace\s+)?(?:function|procedure|table|view|materialized\s+view|trigger|policy|type|index)\s+(?:if\s+not\s+exists\s+)?([^\s(]+)",
            r"(?im)^\s*alter\s+table\s+(?:if\s+exists\s+)?([^\s;]+)",
            r"(?im)^\s*drop\s+(?:function|procedure|table|view|trigger|policy|type|index)\s+(?:if\s+exists\s+)?([^\s(;]+)",
        ]
        for pattern in patterns:
            sql_objects.extend(re.findall(pattern, text))
    headings = [line.strip() for line in lines if line.lstrip().startswith("#")][:20]
    records.append({
        "path": path.as_posix(),
        "size": len(raw),
        "lines": len(lines),
        "sha": sha,
        "norm_sha": norm_sha,
        "objects": sorted(set(sql_objects)),
        "headings": headings,
        "preview": lines[:30],
        "text": text,
    })

exact_groups = {}
normalized_groups = {}
for r in records:
    exact_groups.setdefault(r["sha"], []).append(r["path"])
    normalized_groups.setdefault(r["norm_sha"], []).append(r["path"])

summary = []
summary.append("# Supabase SQL / MD cleanup inventory")
summary.append("")
summary.append(f"Total files: {len(records)}")
summary.append(f"SQL files: {sum(r['path'].lower().endswith('.sql') for r in records)}")
summary.append(f"MD files: {sum(r['path'].lower().endswith('.md') for r in records)}")
summary.append("")
summary.append("## Exact duplicate groups")
for group in exact_groups.values():
    if len(group) > 1:
        summary.append("- " + " | ".join(group))
if not any(len(g) > 1 for g in exact_groups.values()):
    summary.append("- None")
summary.append("")
summary.append("## Whitespace-normalized duplicate groups")
for group in normalized_groups.values():
    if len(group) > 1:
        summary.append("- " + " | ".join(group))
if not any(len(g) > 1 for g in normalized_groups.values()):
    summary.append("- None")
summary.append("")
summary.append("## File list")
for i, r in enumerate(records, 1):
    summary.append("")
    summary.append(f"### {i}. {r['path']}")
    summary.append(f"- Size: {r['size']} bytes")
    summary.append(f"- Lines: {r['lines']}")
    summary.append(f"- SHA256: {r['sha']}")
    if r["objects"]:
        summary.append("- SQL objects: " + ", ".join(r["objects"]))
    if r["headings"]:
        summary.append("- Headings: " + " | ".join(r["headings"]))
    summary.append("- Preview:")
    summary.append("```text")
    summary.extend(r["preview"])
    summary.append("```")

full = []
full.append("# Full contents of Supabase SQL / MD files")
for i, r in enumerate(records, 1):
    full.append("")
    full.append("=" * 100)
    full.append(f"FILE {i}: {r['path']}")
    full.append(f"SHA256: {r['sha']}")
    full.append("=" * 100)
    full.append(r["text"].rstrip())

SUMMARY.write_text("\n".join(summary).rstrip() + "\n", encoding="utf-8")
FULL.write_text("\n".join(full).rstrip() + "\n", encoding="utf-8")
