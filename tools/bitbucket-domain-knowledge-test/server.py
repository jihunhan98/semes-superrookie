"""
Bitbucket Server 도메인 지식 추출 테스트 페이지.

목적: docs/domain-knowledge-from-bitbucket.md 3번(대규모 코드베이스 대응)에서 설계한
"인덱싱 루프"를 실제로 돌려보는 테스트 도구. 레포 URL + 토큰만 넣으면:
  1) 브랜치 목록을 가져와 고르고
  2) 그 브랜치의 소스 파일들을 순회하며 파일마다 사내 LLM에 "이 코드가 다루는 업무
     개념·클래스 역할을 요약해줘"를 보내고(한 번에 보낼 수 있는 입력+출력 글자 수가
     제한돼 있어서, 큰 파일은 잘라 보낸 뒤 부분 요약들을 다시 합치는 map-reduce로 처리),
     결과(파일 경로/요약/태그)를 화면에 실시간으로 쌓아 보여준다.
결과는 메모리(이 프로세스가 떠 있는 동안)에만 쌓인다 — DB 저장은 실제 기능을 만들 때 할 일이고
지금은 테스트용이라 하지 않는다.

실행:
    pip install flask requests
    python server.py
    브라우저에서 http://localhost:5055 접속

이 클라우드 세션은 bit-stms.semes.com 같은 사내 폐쇄망 주소에도, 사내 LLM 엔드포인트에도
접속할 수 없어서, 이 서버 자체(Bitbucket 호출·LLM 호출)는 직접 실행해보지 못했다 — 로컬
가짜 Bitbucket/LLM 서버로 로직만 확인했다. 사내망 안에서 실행해서 검증해야 한다.

사내 LLM 연결은 ai-model 서비스와 같은 방식(OpenAI 호환 /chat/completions, env var로
base/model/key 설정)을 그대로 재사용한다 — 이미 이 프로젝트가 쓰고 있는 설정을 그대로
넣으면 된다.
    LLM_API_BASE   예: http://internal-llm.semes.com/v1
    LLM_API_MODEL  기본값 gpt-4
    LLM_API_KEY    기본값 EMPTY(사내 서비스는 보통 인증 없음)
    LLM_API_TIMEOUT 기본값 60(초)
"""

import json
import os

import requests
from flask import Flask, Response, jsonify, request, send_from_directory, stream_with_context

app = Flask(__name__, static_folder=".")

TIMEOUT_SECONDS = 15

LLM_API_BASE = os.getenv("LLM_API_BASE", "").strip().rstrip("/")
LLM_API_MODEL = os.getenv("LLM_API_MODEL", "gpt-4")
LLM_API_KEY = os.getenv("LLM_API_KEY", "EMPTY")
LLM_API_TIMEOUT = float(os.getenv("LLM_API_TIMEOUT", "60"))

# 한 질의응답(입력+출력 합계)에 대략 3만 자(≈3만 토큰)까지 처리 가능하다는 값을 기준으로
# 잡은 예산. 출력(요약+태그)에 여유를 넉넉히 남기고, 프롬프트 지시문 자체가 차지하는
# 분량도 빼서 실제 "코드를 넣을 수 있는 글자 수"를 계산한다.
MAX_TOTAL_CHARS = int(os.getenv("LLM_MAX_TOTAL_CHARS", "30000"))
OUTPUT_RESERVE_CHARS = int(os.getenv("LLM_OUTPUT_RESERVE_CHARS", "2000"))
PROMPT_OVERHEAD_CHARS = 500
CHUNK_CHARS = MAX_TOTAL_CHARS - OUTPUT_RESERVE_CHARS - PROMPT_OVERHEAD_CHARS

DEFAULT_EXTENSIONS = ["java", "py", "ts", "tsx", "js", "jsx", "xml", "sql", "yml", "yaml"]
DEFAULT_MAX_FILES = 25
MAX_DEPTH = 8  # 디렉터리 재귀 탐색 안전장치

# 마지막 인덱싱 결과 — DB가 아니라 이 프로세스 메모리에만 쌓는다(테스트용).
INDEX_RESULTS: list[dict] = []


class ApiError(Exception):
    pass


def bitbucket_get(base_url: str, path: str, token: str, params: dict | None = None):
    url = base_url.rstrip("/") + path
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=TIMEOUT_SECONDS)
    except requests.exceptions.ConnectionError as e:
        raise ApiError(f"연결 실패 — 이 서버에서 {base_url} 로 네트워크가 안 나가는 것 같습니다: {e}")
    except requests.exceptions.Timeout:
        raise ApiError(f"{TIMEOUT_SECONDS}초 안에 응답이 없었습니다(타임아웃).")

    if resp.status_code == 401:
        raise ApiError("401 Unauthorized — 토큰이 없거나 잘못됐습니다.")
    if resp.status_code == 403:
        raise ApiError("403 Forbidden — 토큰은 유효하지만 이 레포에 대한 읽기 권한이 없습니다.")
    if resp.status_code == 404:
        raise ApiError("404 Not Found — URL/프로젝트 키/레포 슬러그/경로/브랜치를 확인하세요.")
    if not resp.ok:
        raise ApiError(f"{resp.status_code} {resp.reason} — {resp.text[:300]}")
    return resp


def repo_root(project_key: str, repo_slug: str) -> str:
    return f"/rest/api/1.0/projects/{project_key}/repos/{repo_slug}"


def list_files_recursive(base_url, project_key, repo_slug, token, branch, extensions, max_files):
    """browse 엔드포인트는 디렉터리 하나씩만 보여줘서, 하위 디렉터리를 직접 재귀 탐색한다."""
    exts = {e.strip().lower().lstrip(".") for e in extensions if e.strip()}
    found: list[str] = []

    def walk(path: str, depth: int):
        if len(found) >= max_files or depth > MAX_DEPTH:
            return
        browse_path = repo_root(project_key, repo_slug) + "/browse"
        if path:
            browse_path += "/" + path
        params = {"limit": 200}
        if branch:
            params["at"] = f"refs/heads/{branch}"
        resp = bitbucket_get(base_url, browse_path, token, params=params)
        children = resp.json().get("children", {}).get("values", [])
        for c in children:
            if len(found) >= max_files:
                return
            p = c["path"]["toString"]
            if c["type"] == "DIRECTORY":
                walk(p, depth + 1)
            else:
                ext = p.rsplit(".", 1)[-1].lower() if "." in p else ""
                if not exts or ext in exts:
                    found.append(p)

    walk("", 0)
    return found


def fetch_raw_file(base_url, project_key, repo_slug, token, branch, path) -> str:
    params = {}
    if branch:
        params["at"] = f"refs/heads/{branch}"
    resp = bitbucket_get(base_url, repo_root(project_key, repo_slug) + "/raw/" + path, token, params=params)
    # .text 는 안 된다 — charset 없는 응답은 requests가 Latin-1로 잘못 디코딩해서
    # 한글 주석이 깨진다. raw bytes를 직접 UTF-8로 디코드한다.
    return resp.content.decode("utf-8", errors="replace")


def chunk_text_by_lines(text: str, max_chars: int) -> list[str]:
    """긴 파일을 max_chars 이내 덩어리로 자른다 — 줄 단위로 끊어서 코드 한 줄이
    중간에 잘리지 않게 한다(한 줄 자체가 max_chars보다 길면 그 줄만 강제로 자름)."""
    lines = text.splitlines(keepends=True)
    chunks: list[str] = []
    current = ""
    for line in lines:
        if len(line) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            for i in range(0, len(line), max_chars):
                chunks.append(line[i : i + max_chars])
            continue
        if len(current) + len(line) > max_chars:
            chunks.append(current)
            current = line
        else:
            current += line
    if current:
        chunks.append(current)
    return chunks or [""]


def call_llm(messages: list[dict]) -> str:
    if not LLM_API_BASE:
        raise ApiError("LLM_API_BASE가 설정되지 않았습니다 — 사내 LLM 엔드포인트를 환경변수로 넣어주세요.")
    try:
        resp = requests.post(
            f"{LLM_API_BASE}/chat/completions",
            json={"model": LLM_API_MODEL, "messages": messages, "temperature": 0.2},
            timeout=LLM_API_TIMEOUT,
            headers={"Authorization": f"Bearer {LLM_API_KEY}"},
        )
    except requests.exceptions.RequestException as e:
        raise ApiError(f"사내 LLM 호출 실패: {e}")
    if not resp.ok:
        raise ApiError(f"사내 LLM {resp.status_code} — {resp.text[:300]}")
    data = resp.json()
    return data["choices"][0]["message"]["content"]


def parse_summary_tags(raw: str) -> tuple[str, list[str]]:
    summary, tags = raw.strip(), []
    for line in raw.splitlines():
        low = line.strip()
        if low.startswith("요약:"):
            summary = low[len("요약:") :].strip()
        elif low.startswith("태그:"):
            tags = [t.strip() for t in low[len("태그:") :].split(",") if t.strip()]
    return summary, tags


SINGLE_PROMPT = """다음은 소스 파일 하나({path})의 전체 내용이다. 이 코드가 실제로 다루는
업무 개념(도메인 지식)과 클래스/역할을 파악해서 아래 형식으로만 답하라.

요약: <이 파일이 하는 일을 3문장 이내로>
태그: <업무 개념 키워드 3개 이내, 쉼표로 구분>

코드:
{code}"""

CHUNK_PROMPT = """다음은 소스 파일({path})의 일부({idx}/{total} 조각)다. 이 조각이 다루는
업무 개념만 2문장 이내로 짧게 요약하라(태그는 아직 필요 없음).

코드 조각:
{code}"""

REDUCE_PROMPT = """다음은 소스 파일 {path}을 여러 조각으로 나눠 각각 요약한 결과다. 이걸
종합해서 파일 전체 기준으로 아래 형식으로만 답하라.

요약: <파일 전체가 하는 일을 3문장 이내로>
태그: <업무 개념 키워드 3개 이내, 쉼표로 구분>

조각별 요약:
{partials}"""


def summarize_file(path: str, content: str) -> dict:
    if len(content) <= CHUNK_CHARS:
        raw = call_llm([{"role": "user", "content": SINGLE_PROMPT.format(path=path, code=content)}])
        summary, tags = parse_summary_tags(raw)
        return {"summary": summary, "tags": tags, "chunks": 1}

    chunks = chunk_text_by_lines(content, CHUNK_CHARS)
    partials = []
    for i, chunk in enumerate(chunks):
        raw = call_llm(
            [{"role": "user", "content": CHUNK_PROMPT.format(path=path, idx=i + 1, total=len(chunks), code=chunk)}]
        )
        partials.append(raw.strip())

    combined = "\n".join(f"- {p}" for p in partials)
    raw = call_llm([{"role": "user", "content": REDUCE_PROMPT.format(path=path, partials=combined)}])
    summary, tags = parse_summary_tags(raw)
    return {"summary": summary, "tags": tags, "chunks": len(chunks)}


@app.route("/")
def index():
    return send_from_directory(".", "index.html")


@app.route("/diagram-chunking.svg")
def diagram():
    return send_from_directory(".", "diagram-chunking.svg", mimetype="image/svg+xml")


@app.route("/api/branches", methods=["POST"])
def branches():
    body = request.get_json(force=True)
    base_url, project_key, repo_slug, token = (
        body.get("baseUrl", "").strip(),
        body.get("projectKey", "").strip(),
        body.get("repoSlug", "").strip(),
        body.get("token", "").strip(),
    )
    try:
        resp = bitbucket_get(base_url, repo_root(project_key, repo_slug) + "/branches", token, params={"limit": 100})
        names = [v["displayId"] for v in resp.json().get("values", [])]
        return jsonify({"ok": True, "branches": names})
    except ApiError as e:
        return jsonify({"ok": False, "error": str(e)}), 200


@app.route("/api/index-stream", methods=["POST"])
def index_stream():
    body = request.get_json(force=True)
    base_url, project_key, repo_slug, token, branch = (
        body.get("baseUrl", "").strip(),
        body.get("projectKey", "").strip(),
        body.get("repoSlug", "").strip(),
        body.get("token", "").strip(),
        body.get("branch", "").strip(),
    )
    extensions = body.get("extensions") or DEFAULT_EXTENSIONS
    max_files = int(body.get("maxFiles") or DEFAULT_MAX_FILES)

    def line(obj):
        return json.dumps(obj, ensure_ascii=False) + "\n"

    def generate():
        if not LLM_API_BASE:
            yield line({"type": "error", "error": "LLM_API_BASE가 설정 안 됐습니다. server.py를 실행하기 전에 환경변수로 사내 LLM 엔드포인트를 넣어주세요."})
            return
        try:
            files = list_files_recursive(base_url, project_key, repo_slug, token, branch, extensions, max_files)
        except ApiError as e:
            yield line({"type": "error", "error": str(e)})
            return

        yield line({"type": "file_list", "count": len(files)})
        INDEX_RESULTS.clear()
        for i, path in enumerate(files):
            try:
                content = fetch_raw_file(base_url, project_key, repo_slug, token, branch, path)
                result = summarize_file(path, content)
                record = {"path": path, **result}
            except ApiError as e:
                record = {"path": path, "summary": f"(실패: {e})", "tags": [], "chunks": 0, "error": True}
            INDEX_RESULTS.append(record)
            yield line({"type": "result", "index": i + 1, "total": len(files), **record})
        yield line({"type": "done", "total": len(files)})

    return Response(stream_with_context(generate()), mimetype="application/x-ndjson")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5055, debug=True, threaded=True)
