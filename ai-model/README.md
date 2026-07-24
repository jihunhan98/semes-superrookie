# ai-model — AI 추론 서버

요구사항 문장을 받아 모호성 판정 등을 반환하는 FastAPI 서버([`main.py`](main.py))와,
로컬 LLM(Ollama 서빙) 구성 안내.

## 모델

| 항목 | 값 |
|---|---|
| 대상 하드웨어 | 사내 워크스테이션 — Quadro P4000 **VRAM 8GB** · Xeon Gold 5122 · RAM 32GB |
| 1차 후보 모델 | **Qwen3-8B** (GGUF, `Q5_K_M` ≈ 5.85GB) — 8GB VRAM에 통째로 올라감 |
| HF 저장소 | [`Qwen/Qwen3-8B-GGUF`](https://huggingface.co/Qwen/Qwen3-8B-GGUF) |
| 현재 `main.py` 설정 | `qwen2.5:7b-instruct` (스파이크 검증본) — Qwen3-8B로 교체 예정 |

> 학습(파인튜닝) 불필요 — 이미 학습된 모델을 받아 프롬프트만 넣으면 된다.
> 대용량 가중치 파일(.gguf)은 git에 올리지 않는다(용량·폐쇄망 반입 특성).

## 절차 (폐쇄망 기준)

### 1) 인터넷 되는 PC에서 모델 다운로드
```bash
cd ai-model
./download_model.sh          # ./models/Qwen3-8B-Q5_K_M.gguf 생성
```

### 2) `.gguf` 파일을 폐쇄망 워크스테이션으로 반입
USB 등 사내 반입 절차 사용.

### 3) 워크스테이션에서 모델 등록·실행 (Ollama)
```bash
# models/ 옆에 Modelfile 작성:  echo 'FROM ./models/Qwen3-8B-Q5_K_M.gguf' > Modelfile
ollama create qwen3-8b -f Modelfile
ollama run qwen3-8b            # 동작 확인
```
`main.py` 8번 줄 `MODEL_NAME` 을 `"qwen3-8b"` 로 바꾸면 기존 코드 그대로 동작한다.

*(대안: llama.cpp — `./llama-server -m models/Qwen3-8B-Q5_K_M.gguf -ngl 99 -c 4096`. `-ngl 99`=전 레이어 GPU 적재, `-c`=컨텍스트. 8GB를 넘기지 않도록 컨텍스트는 조항 단위로 짧게.)*

### 4) AI 서버 실행
```bash
pip install fastapi "uvicorn[standard]"
uvicorn main:app --host 0.0.0.0 --port 8001
```
