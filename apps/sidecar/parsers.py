import io
import zipfile

import docx
from fastapi import HTTPException
from pypdf import PdfReader

from config import MAX_DOCX_FILES, MAX_DOCX_UNCOMPRESSED_BYTES, MAX_PDF_PAGES


def parse_pdf(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        if len(reader.pages) > MAX_PDF_PAGES:
            raise HTTPException(status_code=413, detail=f"PDF exceeds {MAX_PDF_PAGES} pages")
        return "\n\n".join(text for page in reader.pages if (text := page.extract_text()))
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {error}") from error


def parse_docx(file_bytes: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as archive:
            infos = archive.infolist()
            if len(infos) > MAX_DOCX_FILES or sum(info.file_size for info in infos) > MAX_DOCX_UNCOMPRESSED_BYTES:
                raise HTTPException(status_code=413, detail="DOCX archive expands beyond the configured limit")
        document = docx.Document(io.BytesIO(file_bytes))
        return "\n\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Failed to parse DOCX: {error}") from error
