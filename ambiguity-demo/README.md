# ambiguity-demo — 요구사항 모호성 해결 데모 (React 프론트 + FastAPI 백)

[DESIGN.md](../DESIGN.md) 핵심 기능 1(모호성 해결)을 **텍스트 입력으로 끝까지** 보여주는 최소 데모.
요구사항 원문(여러 줄) → 조항 단위 검출 → 유형 표시 → 해결(해석 입력) / 넘어가기 → 해결 전·후 비교.

```
[React 프론트 web/]  ──POST /api/analyze──▶  [FastAPI app.py]  ──▶  Ollama(qwen3:8b)
                                                                └─(없으면) 규칙 기반 mock
```

- 프론트: **React + Vite** (`web/`)
- 백엔드: **FastAPI** (`app.py`) — Ollama에 `qwen3:8b`가 떠 있으면 실제 LLM 판정, 없으면 mock 폴백 (상단 배지로 모드 표시)

## 세팅 (한 번만)

- **Node.js** 설치 필요 — [nodejs.org](https://nodejs.org) LTS. (React 빌드용)
- **Python** 설치 필요 (백엔드용)
- 둘 다 인바운드(다운로드)만 있으면 되고, 반출 없음.

## 실행 (Windows)

`run.bat` 더블클릭 → React 빌드 + FastAPI 서버 기동 후 http://localhost:8010 자동 오픈.

수동:
```
cd ambiguity-demo/web && npm install && npm run build && cd ..
pip install fastapi "uvicorn[standard]"
python -m uvicorn app:app --port 8010
```
→ http://localhost:8010

### 개발 모드 (프론트 수정하며 볼 때)
```
# 터미널 1 — 백엔드
python -m uvicorn app:app --port 8010
# 터미널 2 — 프론트 (핫리로드, :5173, /api 는 8010으로 프록시)
cd web && npm run dev
```

## 구조
```
ambiguity-demo/
├─ app.py                 백엔드 (판정 API + 빌드된 web/dist 서빙)
├─ web/                   React (Vite)
│  ├─ src/App.jsx         UI 전체 (검출·해결·전후 비교)
│  ├─ src/styles.css
│  └─ ...
├─ run.bat
└─ README.md
```
