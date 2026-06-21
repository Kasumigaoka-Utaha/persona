from __future__ import annotations

from pathlib import Path

import httpx
from bs4 import BeautifulSoup
from docx import Document
from pypdf import PdfReader


class ParseResult(dict):
    parsed_text: str
    parse_status: str
    needs_manual_content: bool


async def parse_link(url: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            response = await client.get(url)
        response.raise_for_status()
        text = _html_to_text(response.text)
        is_feishu = "larkoffice.com" in url or "feishu.cn" in url
        if is_feishu and len(text.strip()) < 80:
            return {
                "parsed_text": "",
                "parse_status": "manual_required",
                "needs_manual_content": True,
            }
        return {
            "parsed_text": text[:20000],
            "parse_status": "parsed",
            "needs_manual_content": False,
        }
    except Exception:
        return {
            "parsed_text": "",
            "parse_status": "manual_required",
            "needs_manual_content": True,
        }


def parse_file(path: Path, original_name: str) -> dict:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        text = parse_pdf(path)
    elif suffix == ".docx":
        text = parse_docx(path)
    elif suffix in {".md", ".txt"}:
        text = path.read_text(encoding="utf-8", errors="ignore")
    else:
        raise ValueError(f"Unsupported file type: {original_name}")
    return {
        "parsed_text": text[:20000],
        "parse_status": "parsed",
        "needs_manual_content": False,
    }


def parse_pdf(path: Path) -> str:
    reader = PdfReader(str(path))
    chunks: list[str] = []
    for page in reader.pages:
        chunks.append(page.extract_text() or "")
    return "\n".join(chunks)


def parse_docx(path: Path) -> str:
    doc = Document(str(path))
    return "\n".join(paragraph.text for paragraph in doc.paragraphs)


def _html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for script in soup(["script", "style"]):
        script.extract()
    return "\n".join(line.strip() for line in soup.get_text("\n").splitlines() if line.strip())
