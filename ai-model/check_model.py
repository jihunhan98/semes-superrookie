#!/usr/bin/env python3
"""Qwen3-8B 로컬 모델 점검 — (1) 잘 돌아가는가 (2) 느린가/ GPU (3) 출력값 잘 나오는가.

Ollama HTTP API만 사용하므로 추가 설치(pip) 불필요.
전제: Ollama 서버 실행 중 + 모델 `qwen3:8b` 등록됨 (register_and_check.bat 참고).
실행:  python check_model.py
"""
import json
import time
import urllib.request

OLLAMA = "http://localhost:11434"
MODEL = "qwen3:8b"

# main.py 와 동일한 모호성 판정 프롬프트
SYSTEM_PROMPT = """당신은 반도체 장비 요구사항 명세서에서 모호한 표현을 찾는 검토자입니다.
다음 유형 중 하나로 분류하세요: 정량 기준 부재 / 모호한 정도부사 / 주어·주체 불명확 / 조건 발생 시점 불명확 / 예외·경계 조건 누락 / 접속사 범위 모호 / 시간·일정 모호 / 해당없음

반드시 아래 JSON 형식으로만 답하세요:
{"ambiguous": true or false, "type": "...", "reason": "..."}
"""

SAMPLES = [
    ("장비는 충분한 내구성을 가져야 한다.", True),
    ("가능한 한 빠르게 처리한다.", True),
    ("장비는 IEC 60204-1 규격을 만족해야 한다.", False),
]


def _post(path, payload, timeout=600):
    req = urllib.request.Request(
        OLLAMA + path, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def _get(path, timeout=30):
    with urllib.request.urlopen(OLLAMA + path, timeout=timeout) as r:
        return json.loads(r.read())


def generate(prompt, fmt=None):
    # Qwen3 는 thinking 모드가 기본 ON → JSON 출력/속도 위해 끈다.
    payload = {"model": MODEL, "prompt": prompt, "stream": False, "think": False}
    if fmt:
        payload["format"] = fmt
    return _post("/api/generate", payload)


def preflight():
    try:
        tags = _get("/api/tags")
    except Exception as e:
        print("✗ Ollama 서버 연결 실패 — 'ollama serve' 실행 여부 확인. (%s)" % e)
        return False
    names = [m.get("name", "") for m in tags.get("models", [])]
    if not any(n == MODEL or n.startswith("qwen3:8b") for n in names):
        print("✗ 모델 '%s' 미등록. 먼저 register_and_check.bat 또는" % MODEL)
        print("    ollama create qwen3:8b -f Modelfile")
        print("  현재 등록된 모델:", names)
        return False
    return True


def check_runs():
    print("\n[1] 잘 돌아가는가")
    try:
        r = generate("한국어로 '테스트 성공' 이라고만 답해줘.")
        print("  ✓ 응답 수신:", (r.get("response", "").strip()[:60] or "(빈 응답)"))
        return True
    except Exception as e:
        print("  ✗ 실행 실패:", e)
        return False


def check_speed():
    print("\n[2] 느린가 (속도 · GPU)")
    try:
        r = generate("반도체 장비 자동화를 세 문장으로 설명해줘.")
    except Exception as e:
        print("  ✗ 생성 실패:", e)
        return
    ec, ed = r.get("eval_count", 0), r.get("eval_duration", 0)  # ed: ns
    if ec and ed:
        tps = ec / (ed / 1e9)
        verdict = ("정상(GPU 추정)" if tps >= 12 else
                   "다소 느림(부분 CPU 오프로딩?)" if tps >= 5 else
                   "매우 느림(CPU로 도는 중일 가능성)")
        print("  생성 속도: %.1f tokens/s  → %s" % (tps, verdict))
    try:
        for m in _get("/api/ps").get("models", []):
            if m.get("name", "").startswith("qwen3"):
                size, vram = m.get("size", 0), m.get("size_vram", 0)
                pct = (vram / size * 100) if size else 0
                loc = "GPU" if pct >= 99 else "CPU" if pct == 0 else "GPU/CPU 혼합"
                print("  적재 위치: %s (VRAM %.0f%%)" % (loc, pct))
    except Exception:
        pass


def check_output():
    print("\n[3] 출력값 잘 나오는가 (모호성 판정)")
    ok = 0
    for sentence, expected in SAMPLES:
        try:
            r = generate('%s\n입력: "%s"\n출력:' % (SYSTEM_PROMPT, sentence), fmt="json")
            parsed = json.loads(r.get("response", "{}"))
            hit = (parsed.get("ambiguous") == expected)
            ok += hit
            print("  %s \"%s\"" % ("✓" if hit else "✗", sentence))
            print("      → %s" % json.dumps(parsed, ensure_ascii=False))
        except Exception as e:
            print("  ✗ \"%s\" — 파싱 실패: %s" % (sentence, e))
    print("  판정 정확도: %d/%d" % (ok, len(SAMPLES)))


if __name__ == "__main__":
    print("=== Qwen3-8B 로컬 모델 점검 (%s) ===" % MODEL)
    t0 = time.time()
    if preflight():
        check_runs()
        check_speed()
        check_output()
    print("\n완료. (총 %.1fs)" % (time.time() - t0))
