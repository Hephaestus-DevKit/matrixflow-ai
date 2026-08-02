import re
from typing import List


def clean_text(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\r\n|\r", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> List[str]:
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be between 0 and chunk_size - 1")

    paragraphs = [paragraph.strip() for paragraph in text.split("\n\n") if paragraph.strip()]
    chunks: List[str] = []
    current = ""

    def emit(value: str) -> None:
        value = value.strip()
        if value:
            chunks.append(value)

    for paragraph in paragraphs:
        if len(paragraph) > chunk_size:
            emit(current)
            current = ""
            step = chunk_size - overlap
            for start in range(0, len(paragraph), step):
                emit(paragraph[start:start + chunk_size])
                if start + chunk_size >= len(paragraph):
                    break
            continue

        candidate = paragraph if not current else f"{current}\n\n{paragraph}"
        if len(candidate) <= chunk_size:
            current = candidate
            continue

        emit(current)
        prefix_capacity = max(0, chunk_size - len(paragraph) - 2)
        prefix_length = min(overlap, prefix_capacity)
        prefix = current[-prefix_length:].lstrip() if prefix_length else ""
        current = f"{prefix}\n\n{paragraph}" if prefix else paragraph

    emit(current)
    return chunks
