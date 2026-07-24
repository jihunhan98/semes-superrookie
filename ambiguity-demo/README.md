# ambiguity-demo — 요구사항 모호성 해결 데모 (프론트 + 백)

[DESIGN.md](../DESIGN.md) 핵심 기능 1(모호성 해결)을 **텍스트 입력으로 끝까지** 보여주는 최소 데모.
요구사항 원문(여러 줄) → 조항 단위 검출 → 유형 표시 → 해결(해석 입력) / 넘어가기 → 해결 전·후 비교.

```
[웹 프론트 static/index.html]  ──POST /api/analyze──▶  [FastAPI app.py]  ──▶  Ollama(qwen3:8b)
                                                                          └─(없으면) 규칙 기반 mock
```

- **Ollama에 `qwen3:8b`가 떠 있으면** → 실제 LLM으로 판정 (ai-model과 같은 프롬프트).
- **안 떠 있으면** → 규칙 기반 mock으로 폴백 → 모델 없이도 화면 흐름 확인 가능.
  (화면 상단 배지에 어느 모드인지 표시됨)

## 실행 (Windows)

`run.bat` 더블클릭. → 의존성 설치 후 브라우저에서 http://localhost:8010 자동 오픈.

수동으로 하려면:
```
cd ambiguity-demo
pip install fastapi "uvicorn[standard]"
python -m uvicorn app:app --port 8010
```
→ 브라우저에서 http://localhost:8010

## 사용

1. 텍스트 영역에 요구사항을 **한 줄에 조항 하나씩** 붙여넣기 (샘플 미리 채워둠)
2. **분석** → 조항별로 모호/명확 + 모호 유형이 표시됨
3. 모호 조항에서 **해결하기**(해석 입력 → 확정) 또는 **해결 불필요·넘어가기**
4. 확정하면 **해결 전 / 해결 후** 비교로 바뀜
