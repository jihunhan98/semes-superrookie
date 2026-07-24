# ai-model — AI 추론 서버

요구사항 문장을 받아 모호성 판정을 반환하는 FastAPI 서버([`main.py`](main.py))와,
로컬 LLM(Ollama 서빙) 구성.

| 항목 | 값 |
|---|---|
| 대상 하드웨어 | 워크스테이션 — Quadro P4000 VRAM 8GB · Xeon Gold 5122 · RAM 32GB |
| 모델 | **Qwen3-8B** (`qwen3:8b`) — GGUF, 8GB VRAM에 통째로 올라감 |
| 네트워크 | 반입 O / 반출 X — 다운로드(인바운드)는 됨 |

## 파일

| 파일 | 역할 |
|---|---|
| `main.py` | FastAPI 서버 (`/analyze`, `/health`) — Ollama 호출 |
| `check_model.py` | 모델 점검 — 동작 / 속도·GPU / 출력값. `main.py`의 `/analyze`를 재사용 |
| `register_and_check.bat` | (Windows) 받은 GGUF를 `qwen3:8b`로 등록 + 점검까지 한 번에 |

## 실행 절차 (Windows)

**사전 준비** — cmd에서 `ollama --version`, `python --version` 이 되는지 확인.
안 되면 각각 설치: Ollama([ollama.com/download](https://ollama.com/download)), Python([python.org](https://www.python.org/downloads/), 설치 시 "Add to PATH" 체크). 설치 후 cmd를 새로 연다.

1. 받은 `Qwen3-8B-Q5_K_M.gguf` 파일을 이 `ai-model` 폴더 안에 둔다.
2. `register_and_check.bat` 더블클릭 (또는 이 폴더에서 실행).
   - ① GGUF를 `qwen3:8b`로 등록(`ollama create`) → ② 의존성 설치 → ③ `check_model.py` 실행
3. 결과 확인 — 판정 정확도 / 문장당 속도 / GPU·CPU 적재 위치가 출력된다.

> 서버만 따로 띄우려면: `pip install fastapi "uvicorn[standard]"` 후 `uvicorn main:app --port 8001`.
> 모델 가중치(.gguf)는 용량 때문에 git에 올리지 않는다.
