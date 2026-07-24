# ai-model — AI 추론 서버

요구사항 문장을 받아 모호성 판정 등을 반환하는 FastAPI 서버([`main.py`](main.py))와,
로컬 LLM(Ollama 서빙) 구성 안내.

## 모델

| 항목 | 값 |
|---|---|
| 대상 하드웨어 | 사내 워크스테이션 — Quadro P4000 **VRAM 8GB** · Xeon Gold 5122 · RAM 32GB |
| 1차 후보 모델 | **Qwen3-8B** — 8GB VRAM에 통째로 올라감 |
| `main.py` 설정 | `MODEL_NAME = "qwen3:8b"` (스파이크 검증본은 `qwen2.5:7b-instruct`) |

> 학습(파인튜닝) 불필요 — 이미 학습된 모델을 받아 프롬프트만 넣으면 된다.
> 모델 가중치는 git에 올리지 않는다(GitHub 100MB 파일 제한 · 용량).
> **네트워크: 반입 O / 반출 X** — 다운로드(인바운드)는 되므로 워크스테이션에서 바로 받으면 된다.

## 설치 (제일 쉬운 길 — Ollama)

워크스테이션에서 스크립트 한 번 실행하면 Ollama 설치 + 모델 다운로드까지 끝.

```bash
cd ai-model
./setup_ollama.sh
```

이게 하는 일: ① Ollama 설치(`curl`) → ② GPU 드라이버 확인 → ③ Ollama 서버 시작 → ④ `ollama pull qwen3:8b`.

**설정 참고**
- **Linux**: 위 스크립트 그대로. 설치 중 `sudo` 암호를 물을 수 있음.
- **GPU 가속(P4000)**: NVIDIA 드라이버가 있어야 함(`nvidia-smi` 동작). 없으면 자동으로 CPU로 동작 → 되긴 하지만 느림.
- **Windows**: 스크립트 대신 [ollama.com/download](https://ollama.com/download)에서 설치 프로그램(OllamaSetup.exe) 실행 후, 명령프롬프트에서 `ollama pull qwen3:8b`.

## AI 서버 실행

```bash
pip install fastapi "uvicorn[standard]"
uvicorn main:app --host 0.0.0.0 --port 8001
```
`main.py`의 `MODEL_NAME`이 `qwen3:8b`라 위에서 받은 모델과 그대로 물린다.

---

### (대안) HuggingFace에서 GGUF 파일로 직접 받기

Ollama 레지스트리 대신 파일을 직접 관리하고 싶을 때. [`download_model.sh`](download_model.sh) 실행 →
`./models/Qwen3-8B-Q5_K_M.gguf`(≈5.85GB) 생성 → Ollama에 같은 이름으로 등록:

```bash
echo 'FROM ./models/Qwen3-8B-Q5_K_M.gguf' > Modelfile
ollama create qwen3:8b -f Modelfile
```
*(또는 llama.cpp: `./llama-server -m models/Qwen3-8B-Q5_K_M.gguf -ngl 99 -c 4096`. `-ngl 99`=전 레이어 GPU 적재, `-c`=컨텍스트. 8GB를 넘기지 않도록 컨텍스트는 짧게.)*
