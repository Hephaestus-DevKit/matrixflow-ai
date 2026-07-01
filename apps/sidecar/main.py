import io
import re
from typing import List, Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from pypdf import PdfReader
import docx

app = FastAPI(title="MatrixFlow AI Python Sidecar", version="0.1.0")

def clean_text(text: str) -> str:
    # 替换连续的空白字符，但保留段落换行
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\r\n|\r', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def parse_pdf(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        text_list = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_list.append(text)
        return "\n\n".join(text_list)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")

def parse_docx(file_bytes: bytes) -> str:
    try:
        doc = docx.Document(io.BytesIO(file_bytes))
        text_list = []
        for para in doc.paragraphs:
            if para.text:
                text_list.append(para.text)
        return "\n\n".join(text_list)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse DOCX: {str(e)}")

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> List[str]:
    # 语义/段落感知的智能分块
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = []
    current_len = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        para_len = len(para)

        # 如果单段太长（超过了 chunk_size），需要按句子切割
        if para_len > chunk_size:
            # 如果当前累计分块有内容，先归档
            if current_chunk:
                chunks.append("\n\n".join(current_chunk))
                current_chunk = []
                current_len = 0
            
            # 对超长段落按标点切句 (。！？. ! ?)
            sentences = re.split(r'([。！？.!?]\s*)', para)
            # 重组句子与分隔符
            merged_sentences = []
            i = 0
            while i < len(sentences):
                s = sentences[i]
                if i + 1 < len(sentences):
                    s += sentences[i+1]
                    i += 1
                s = s.strip()
                if s:
                    merged_sentences.append(s)
                i += 1
            
            # 将切句后的内容组装成合适大小的 chunks
            sub_chunk = []
            sub_len = 0
            for s in merged_sentences:
                s_len = len(s)
                if sub_len + s_len > chunk_size:
                    if sub_chunk:
                        chunks.append(" ".join(sub_chunk))
                    # 重叠度考虑：保留后 1-2 句作为重叠
                    overlap_size = 0
                    overlap_chunk = []
                    for prev_s in reversed(sub_chunk):
                        if overlap_size + len(prev_s) <= overlap:
                            overlap_chunk.insert(0, prev_s)
                            overlap_size += len(prev_s)
                        else:
                            break
                    sub_chunk = overlap_chunk + [s]
                    sub_len = sum(len(x) for x in sub_chunk)
                else:
                    sub_chunk.append(s)
                    sub_len += s_len
            if sub_chunk:
                chunks.append(" ".join(sub_chunk))
            continue

        # 普通段落合并逻辑
        if current_len + para_len > chunk_size:
            if current_chunk:
                chunks.append("\n\n".join(current_chunk))
            
            # 计算重叠段落
            overlap_size = 0
            overlap_chunk = []
            for prev_para in reversed(current_chunk):
                if overlap_size + len(prev_para) <= overlap:
                    overlap_chunk.insert(0, prev_para)
                    overlap_size += len(prev_para)
                else:
                    break
            current_chunk = overlap_chunk + [para]
            current_len = sum(len(p) for p in current_chunk)
        else:
            current_chunk.append(para)
            current_len += para_len

    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    return [c.strip() for c in chunks if c.strip()]

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/parse")
async def parse_document(
    file: UploadFile = File(...),
    chunk_size: int = Query(800, description="Max size of each chunk"),
    overlap: int = Query(100, description="Overlap between chunks")
) -> Dict[str, Any]:
    filename = file.filename or ""
    content_type = file.content_type or ""
    file_bytes = await file.read()

    text = ""
    # 根据文件扩展名或 MimeType 路由
    if filename.endswith(".pdf") or "pdf" in content_type:
        text = parse_pdf(file_bytes)
    elif filename.endswith(".docx") or "word" in content_type or "officedocument" in content_type:
        text = parse_docx(file_bytes)
    else:
        # 默认文本文件读取
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text = file_bytes.decode("gbk")
            except UnicodeDecodeError:
                raise HTTPException(status_code=400, detail="Unsupported file format or encoding")

    cleaned_text = clean_text(text)
    chunks = chunk_text(cleaned_text, chunk_size, overlap)

    return {
        "filename": filename,
        "text": cleaned_text,
        "chunks": chunks,
        "metadata": {
            "char_count": len(cleaned_text),
            "chunk_count": len(chunks)
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
