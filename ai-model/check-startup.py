"""Check the local AI server after run-all.bat starts it."""

import json
import time
import urllib.error
import urllib.request


BASE_URL = "http://127.0.0.1:8001"


def main() -> int:
    print("[AI 확인] 서버 기동을 기다리는 중...", flush=True)
    for attempt in range(20):
        try:
            with urllib.request.urlopen(f"{BASE_URL}/health", timeout=2) as response:
                health = json.load(response)
            if health.get("status") == "ok":
                break
        except (OSError, ValueError):
            pass
        if attempt < 19:
            time.sleep(1)
    else:
        print("[AI 확인] 실패: AI 서버가 20초 안에 응답하지 않았습니다.", flush=True)
        return 1

    print("[AI 확인] 서버 정상 가동. 검토 API에 테스트 요청 중...", flush=True)
    request = urllib.request.Request(
        f"{BASE_URL}/analyze",
        data=json.dumps({"content": "AMR은 지정된 조건에 따라 작업을 시작한다."}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        print(f"[AI 확인] 검토 API 실패: HTTP {error.code}", flush=True)
        return 1
    except (OSError, ValueError) as error:
        print(f"[AI 확인] 검토 API 실패: {type(error).__name__}", flush=True)
        return 1

    engine = result.get("engine")
    if engine == "llm-api":
        print("[AI 확인] 검토 성공: 모델 응답을 받았습니다. (engine=llm-api)", flush=True)
    elif engine == "rule":
        print("[AI 확인] 검토 성공: 규칙 기반 응답입니다. 모델 연결/인증은 확인이 필요합니다. (engine=rule)", flush=True)
    else:
        print(f"[AI 확인] 검토 API 응답의 engine 값이 예상과 다릅니다: {engine!r}", flush=True)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
