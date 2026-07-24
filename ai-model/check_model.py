#!/usr/bin/env python3
"""Qwen3-8B 점검 — 기존 AI 서버(main.py 의 /analyze)를 그대로 사용해서
(1) 잘 돌아가는가  (2) 느린가 / GPU  (3) 출력값 잘 나오는가 를 확인한다.

프롬프트를 새로 만들지 않고 main.py 를 재사용한다. 서버가 안 떠 있으면
uvicorn 으로 main.py 를 자동 기동했다가 끝나면 내린다.

실행:  python check_model.py
"""
import json
import os
import subprocess
import sys
import time
import urllib.request

API = "http://localhost:8001"          # main.py (FastAPI)
OLLAMA = "http://localhost:11434"       # GPU/CPU 적재 확인용
HERE = os.path.dirname(os.path.abspath(__file__))

SAMPLES = [
    ("장비는 충분한 내구성을 가져야 한다.", True),
    ("가능한 한 빠르게 처리한다.", True),
    ("장비는 IEC 60204-1 규격을 만족해야 한다.", False),
]


def _get(url, timeout=5):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.loads(r.read())


def _post(url, payload, timeout=600):
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def server_up():
    try:
        _get(API + "/health", timeout=2)
        return True
    except Exception:
        return False


def start_server():
    print("  main.py 서버 자동 기동 (uvicorn :8001)")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--port", "8001"],
        cwd=HERE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(90):
        if server_up():
            return proc
        time.sleep(1)
    proc.terminate()
    raise RuntimeError("서버가 뜨지 않음 — 'pip install fastapi uvicorn' 확인")


def analyze(sentence):
    t = time.time()
    r = _post(API + "/analyze", {"sentence": sentence})
    return r, time.time() - t


def main():
    print("=== Qwen3-8B 점검 (기존 main.py /analyze 재사용) ===")
    proc = None
    if server_up():
        print("  기존 서버 감지됨")
    else:
        proc = start_server()

    try:
        # [1] 잘 돌아가는가
        print("\n[1] 잘 돌아가는가")
        r, dt = analyze("테스트 문장입니다.")
        print("  ✓ /analyze 응답 %.1fs → %s" % (dt, json.dumps(r, ensure_ascii=False)))

        # [2] 속도 + [3] 출력값 (한 번에)
        print("\n[2]+[3] 속도 · 출력값 (모호성 판정)")
        ok, times = 0, []
        for sentence, expected in SAMPLES:
            r, dt = analyze(sentence)
            times.append(dt)
            hit = (r.get("ambiguous") == expected)
            ok += hit
            print("  %s (%.1fs) \"%s\"\n        → %s"
                  % ("✓" if hit else "✗", dt, sentence, json.dumps(r, ensure_ascii=False)))
        avg = sum(times) / len(times)
        verdict = ("정상" if avg <= 6 else
                   "느림(부분 CPU 오프로딩?)" if avg <= 15 else
                   "매우 느림(CPU로 도는 중일 가능성)")
        print("  판정 정확도: %d/%d   |   평균 %.1fs/문장 → %s" % (ok, len(SAMPLES), avg, verdict))

        # GPU/CPU 적재 위치
        try:
            for m in _get(OLLAMA + "/api/ps").get("models", []):
                if m.get("name", "").startswith("qwen3"):
                    size, vram = m.get("size", 0), m.get("size_vram", 0)
                    pct = (vram / size * 100) if size else 0
                    loc = "GPU" if pct >= 99 else "CPU" if pct == 0 else "GPU/CPU 혼합"
                    print("  적재 위치: %s (VRAM %.0f%%)" % (loc, pct))
        except Exception:
            pass

    finally:
        if proc:
            proc.terminate()
            print("\n  (자동 기동한 서버 종료)")
    print("완료.")


if __name__ == "__main__":
    main()
