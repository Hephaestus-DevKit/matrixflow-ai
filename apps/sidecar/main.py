from typing import Any, Dict

from fastapi import FastAPI, File, HTTPException, Query, UploadFile

from config import MAX_CHUNKS, MAX_EXTRACTED_CHARS, MAX_FILE_BYTES
from parsers import parse_docx, parse_pdf
from text_processing import chunk_text, clean_text

app = FastAPI(title="MatrixFlow AI Python Sidecar", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/parse")
async def parse_document(
    file: UploadFile = File(...),
    chunk_size: int = Query(800, ge=32, le=10_000, description="Max size of each chunk"),
    overlap: int = Query(100, ge=0, le=9_968, description="Overlap between chunks"),
) -> Dict[str, Any]:
    if overlap >= chunk_size:
        raise HTTPException(status_code=400, detail="overlap must be smaller than chunk_size")

    filename = file.filename or ""
    normalized_filename = filename.lower()
    content_type = file.content_type or ""
    file_bytes = await file.read(MAX_FILE_BYTES + 1)
    if len(file_bytes) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_FILE_BYTES} bytes")

    if normalized_filename.endswith(".pdf") or "pdf" in content_type:
        text = parse_pdf(file_bytes)
    elif normalized_filename.endswith(".docx") or "word" in content_type or "officedocument" in content_type:
        text = parse_docx(file_bytes)
    elif normalized_filename.endswith((".txt", ".md", ".csv")) or content_type.startswith("text/"):
        text = decode_text(file_bytes)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format")

    cleaned_text = clean_text(text)
    if len(cleaned_text) > MAX_EXTRACTED_CHARS:
        raise HTTPException(status_code=413, detail=f"Extracted text exceeds {MAX_EXTRACTED_CHARS} characters")
    chunks = chunk_text(cleaned_text, chunk_size, overlap)
    if len(chunks) > MAX_CHUNKS:
        raise HTTPException(status_code=413, detail=f"Document exceeds {MAX_CHUNKS} chunks")

    return {
        "filename": filename,
        "text": cleaned_text,
        "chunks": chunks,
        "metadata": {"char_count": len(cleaned_text), "chunk_count": len(chunks)},
    }


def decode_text(file_bytes: bytes) -> str:
    for encoding in ("utf-8", "gbk"):
        try:
            return file_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise HTTPException(status_code=400, detail="Unsupported file format or encoding")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
