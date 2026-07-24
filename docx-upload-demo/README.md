# docx-upload-demo — docx 업로드 확인 도구

보안 검토 전에 **"docx가 웹으로 잘 업로드되고 내용이 제대로 파싱되는가"** 만 확인하는 최소 도구.
업로드한 `.docx`를 python-docx로 파싱해 **문단·표를 그대로 웹에 뿌린다.** (모호성 판정 등은 안 함)

```
[정적 HTML static/index.html]  ──POST /api/upload (multipart)──▶  [FastAPI app.py]  ──▶  python-docx 파싱
```

프론트는 빌드 필요 없는 정적 HTML이라 **Python만 있으면 됨** (Node/npm 불필요).

## 실행 (Windows)

`run.bat` 더블클릭 → http://localhost:8020 자동 오픈 → 파일 선택 후 **업로드**.

수동:
```
cd docx-upload-demo
pip install fastapi "uvicorn[standard]" python-docx python-multipart
python -m uvicorn app:app --port 8020
```

> pip이 사내 프록시 인증서로 막히면:
> `pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org fastapi uvicorn python-docx python-multipart`

## 확인 포인트

- **업로드 성공 여부** (초록 배지)
- **문단 수 / 표 수** (실제 명세서에서 조항 단위 분리가 되는지 감 잡기)
- 표·이미지 섞인 실제 포맷이 잘 파싱되는지 → 안 되면 파싱 로직(app.py) 보강 대상
