#!/usr/bin/env python3
"""Read-only checks for AI Project Kit documents; Python 3.10+, no dependencies."""
from __future__ import annotations

import argparse
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

REQUIRED = ('AGENTS.md', 'CLAUDE.md', 'handbook/README.md', 'handbook/00-project-overview.md', 'handbook/01-current-status.md', 'handbook/02-function-design.md', 'handbook/03-ui-design.md', 'handbook/04-project-architecture.md', 'handbook/05-data-design.md', 'handbook/06-api-design.md', 'handbook/07-environment.md', 'handbook/08-deployment.md', 'handbook/09-current-plan.md', 'handbook/10-quality.md', 'handbook/11-decisions.md', 'handbook/12-references.md', 'handbook/13-operation-guide.md')
LINK = re.compile(r'!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+"[^"\n]*")?\s*\)')
PLACEHOLDER = re.compile(r'待填写|待初始化|尚未初始化|YYYY-MM-DD')


def prose(text: str) -> str:
    """Ignore fenced examples and comments when inspecting instructions."""
    lines = []
    fence = None
    for line in text.splitlines():
        match = re.match(r'^\s*(`{3,}|~{3,})', line)
        if match:
            mark = match.group(1)
            if fence is None:
                fence = mark
            elif mark[0] == fence[0] and len(mark) >= len(fence):
                fence = None
            continue
        if fence is None:
            lines.append(line)
    return re.sub(r'<!--.*?-->', '', '\n'.join(lines), flags=re.S)


def inspect(root: Path, strict_init: bool = False) -> tuple[list[str], list[str], int]:
    root = root.resolve()
    errors: list[str] = []
    warnings: list[str] = []
    for name in REQUIRED:
        if not (root / name).is_file():
            errors.append(f'缺少核心文件：{name}')
    candidates = [root / name for name in ('AGENTS.md', 'CLAUDE.md')]
    docs = root / 'handbook'
    if docs.is_dir():
        candidates.extend(sorted(docs.rglob('*.md')))
    texts: dict[Path, str] = {}
    for path in candidates:
        if not path.is_file():
            continue
        if not path.resolve().is_relative_to(root):
            errors.append(f'文档链接到项目外部：{path.relative_to(root)}')
            continue
        rel = path.relative_to(root).as_posix()
        try:
            text = path.read_text(encoding='utf-8')
        except (OSError, UnicodeError) as exc:
            errors.append(f'无法读取 UTF-8 文档：{rel} ({type(exc).__name__})')
            continue
        texts[path] = prose(text)
        limit = 5000 if rel in ('AGENTS.md', 'handbook/01-current-status.md') else 12000
        if len(text) > limit:
            warnings.append(f'篇幅提醒：{rel} 共 {len(text)} 字符，参考阈值 {limit}；检查是否需要按主题拆分，不要机械删除')
        if rel in ('handbook/00-project-overview.md', 'handbook/01-current-status.md') and PLACEHOLDER.search(texts[path]):
            message = f'项目事实尚未填好：{rel}'
            (errors if strict_init else warnings).append(message)
        for match in LINK.finditer(texts[path]):
            target = match.group(1).strip('<>')
            parts = urlsplit(target)
            if parts.scheme or parts.netloc or not parts.path:
                continue
            resolved = (path.parent / unquote(parts.path)).resolve()
            if not resolved.is_relative_to(root):
                errors.append(f'不可移植的项目外链接：{rel} → {target}')
            elif not resolved.exists():
                errors.append(f'失效文件链接：{rel} → {target}')
    claude = texts.get(root / 'CLAUDE.md', '')
    if (root / 'CLAUDE.md').is_file() and not re.search(r'^\s*@AGENTS\.md\s*$', claude, re.M):
        errors.append('CLAUDE.md 缺少单独一行的 @AGENTS.md 导入')
    return errors, warnings, len(texts)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2], help='目标业务项目根目录')
    parser.add_argument('--strict-init', action='store_true', help='将核心项目事实占位符视为错误')
    args = parser.parse_args()
    errors, warnings, count = inspect(args.root, args.strict_init)
    for item in warnings:
        print(f'WARN {item}')
    for item in errors:
        print(f'ERROR {item}')
    print(f'检查 {count} 个 Markdown 文件；错误 {len(errors)}，提醒 {len(warnings)}。未修改文件。')
    print('范围：核心文件、Claude 导入、行内本地文件链接及篇幅；不检查锚点、引用式链接、网络可用性、内容真实性或模型执行情况。')
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
