from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8-sig")


def extract_headings(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.startswith("#")]


def main() -> None:
    root_readme = read_text("README.md")
    supabase_readme = read_text("supabase/README.md")
    agents = read_text("AGENTS.md")
    spec = read_text("規格書.txt")
    package = json.loads(read_text("package.json"))
    deploy_script = read_text("scripts/deploy-v2-final.ps1")

    function_dirs = sorted(
        p.parent.name
        for p in (ROOT / "supabase" / "functions").glob("*/index.ts")
        if p.is_file()
    )
    deployed = re.findall(r'^\s*"([a-z0-9-]+)"\s*,?\s*$', deploy_script, flags=re.MULTILINE)

    references: list[str] = []
    excluded = {
        Path("scripts/audit_readme_merge_once.py"),
        Path("readme_merge_audit.txt"),
    }
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT)
        if rel in excluded or ".git" in rel.parts:
            continue
        if path.suffix.lower() not in {".md", ".txt", ".js", ".ts", ".ps1", ".json", ".yml", ".yaml"}:
            continue
        try:
            text = path.read_text(encoding="utf-8-sig")
        except UnicodeDecodeError:
            continue
        if "supabase/README.md" in text or "supabase\\README.md" in text:
            references.append(str(rel).replace("\\", "/"))

    key_phrases = [
        "001_current_schema.sql",
        "002_current_updates.sql",
        "schedule_entries",
        "save_schedule_entries_bulk",
        "save_attendance_clock",
        "attendance_records",
        "attendance_action_logs",
        "attendance_overtime_requests",
        "overtime_review_logs",
        "meal_products",
        "meal_settings",
        "meal_orders",
        "leave_requests",
        "overtime_requests",
        "clock_locations",
        "attendance_logs",
        "固定 IP",
        "原始 GPS",
        "安全 RPC",
        "Edge Functions",
    ]

    lines: list[str] = []
    lines.append("# README 整併盤點")
    lines.append("")
    lines.append("## package.json scripts")
    for name, command in package.get("scripts", {}).items():
        lines.append(f"- {name}: {command}")

    lines.append("")
    lines.append("## Supabase Edge Function 目錄")
    for name in function_dirs:
        lines.append(f"- {name}")

    lines.append("")
    lines.append("## deploy-v2-final.ps1 部署清單")
    for name in deployed:
        lines.append(f"- {name}")

    lines.append("")
    lines.append("## 清單差異")
    lines.append(f"- 目錄存在但部署腳本未列出：{', '.join(sorted(set(function_dirs) - set(deployed))) or '無'}")
    lines.append(f"- 部署腳本列出但目錄不存在：{', '.join(sorted(set(deployed) - set(function_dirs))) or '無'}")

    lines.append("")
    lines.append("## supabase/README.md 引用位置")
    for ref in references:
        lines.append(f"- {ref}")
    if not references:
        lines.append("- 無")

    lines.append("")
    lines.append("## 規格書關鍵內容存在狀況")
    for phrase in key_phrases:
        lines.append(f"- {phrase}: {'有' if phrase in spec else '無'}")

    lines.append("")
    lines.append("## 根 README 標題")
    lines.extend(f"- {heading}" for heading in extract_headings(root_readme))

    lines.append("")
    lines.append("## Supabase README 標題")
    lines.extend(f"- {heading}" for heading in extract_headings(supabase_readme))

    lines.append("")
    lines.append("## AGENTS 標題")
    lines.extend(f"- {heading}" for heading in extract_headings(agents))

    (ROOT / "readme_merge_audit.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
