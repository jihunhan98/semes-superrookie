"""docx 업로드 확인 데모 — 백엔드 (FastAPI).

목적: 보안 검토 전에 "docx 파일이 웹으로 잘 업로드되고, 내용이 제대로 파싱되는가"만
확인하는 최소 도구. 업로드된 .docx를 python-docx로 파싱해 문단/표를 그대로 웹에 뿌린다.
(모호성 판정 등은 하지 않음 — 업로드·파싱 확인 전용)
"""
import io
import os

from docx import Document
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse

HERE = os.path.dirname(os.path.abspath(__file__))
app = FastAPI(title="docx 업로드 확인")


@app.get("/")
def index():
    return FileResponse(os.path.join(HERE, "static", "index.html"))


@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    name = file.filename or ""
    if not name.lower().endswith(".docx"):
        return {"ok": False, "error": ".docx 파일만 업로드하세요.", "filename": name}
    try:
        data = await file.read()
        doc = Document(io.BytesIO(data))
    except Exception as e:
        return {"ok": False, "error": f"파싱 실패: {e}", "filename": name}

    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    tables = []
    for t in doc.tables:
        tables.append([[c.text for c in row.cells] for row in t.rows])

    return {
        "ok": True,
        "filename": name,
        "size_kb": round(len(data) / 1024, 1),
        "paragraph_count": len(paragraphs),
        "table_count": len(tables),
        "paragraphs": paragraphs,
        "tables": tables,
    }
