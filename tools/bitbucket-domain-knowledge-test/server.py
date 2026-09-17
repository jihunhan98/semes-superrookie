"""
Bitbucket Server REST API 연결 테스트용 백엔드.

목적: 사내 Bitbucket Server(bit-stms.semes.com:17990 같은)에 URL·프로젝트 키·레포
슬러그·Personal Access Token만 입력해서 (1) 브랜치 목록, (2) 루트 디렉터리 파일
목록, (3) 특정 파일의 실제 내용을 가져올 수 있는지 확인하는 최소 테스트 도구다.
도메인 지식 추출 기능을 실제로 만들기 전에 "이 사내망에서 API 호출이 되는지,
토큰 권한이 맞는지"만 먼저 확인하려는 것 — 이 코드 자체는 실제 기능이 아니다.

실행:
    pip install flask requests
    python server.py
    브라우저에서 http://localhost:5055 접속

이 클라우드 세션은 bit-stms.semes.com 같은 사내 폐쇄망 주소에 접속할 수 없어서,
이 서버 자체는 직접 실행해보지 못했다 — 사내망 안에서 실행해야 한다.
"""

import requests
from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__, static_folder=".")

TIMEOUT_SECONDS = 15


def bitbucket_get(base_url: str, path: str, token: str, params: dict | None = None):
    """Bitbucket Server REST API에 GET 요청 하나를 보낸다. 실패 이유를 사람이 읽을 수
    있는 형태로 되돌리려고 상태코드별로 구분한다(401=토큰 문제, 404=경로/레포 문제 등)."""
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
        raise ApiError("404 Not Found — Base URL/프로젝트 키/레포 슬러그/경로/브랜치를 확인하세요.")
    if not resp.ok:
        raise ApiError(f"{resp.status_code} {resp.reason} — {resp.text[:300]}")
    return resp


class ApiError(Exception):
    pass


def repo_root(base_url: str, project_key: str, repo_slug: str) -> str:
    return f"/rest/api/1.0/projects/{project_key}/repos/{repo_slug}"


@app.route("/")
def index():
    return send_from_directory(".", "index.html")


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
        resp = bitbucket_get(
            base_url,
            repo_root(base_url, project_key, repo_slug) + "/branches",
            token,
            params={"limit": 100},
        )
        data = resp.json()
        names = [v["displayId"] for v in data.get("values", [])]
        return jsonify({"ok": True, "branches": names, "raw": data})
    except ApiError as e:
        return jsonify({"ok": False, "error": str(e)}), 200


@app.route("/api/browse", methods=["POST"])
def browse():
    body = request.get_json(force=True)
    base_url, project_key, repo_slug, token, branch, path = (
        body.get("baseUrl", "").strip(),
        body.get("projectKey", "").strip(),
        body.get("repoSlug", "").strip(),
        body.get("token", "").strip(),
        body.get("branch", "").strip(),
        body.get("path", "").strip().lstrip("/"),
    )
    try:
        browse_path = repo_root(base_url, project_key, repo_slug) + "/browse"
        if path:
            browse_path += "/" + path
        params = {"limit": 200}
        if branch:
            params["at"] = f"refs/heads/{branch}"
        resp = bitbucket_get(base_url, browse_path, token, params=params)
        data = resp.json()
        children = data.get("children", {}).get("values", [])
        entries = [
            {"path": c["path"]["toString"], "type": c["type"]}  # "FILE" 또는 "DIRECTORY"
            for c in children
        ]
        return jsonify({"ok": True, "entries": entries})
    except ApiError as e:
        return jsonify({"ok": False, "error": str(e)}), 200


@app.route("/api/file", methods=["POST"])
def file_content():
    body = request.get_json(force=True)
    base_url, project_key, repo_slug, token, branch, path = (
        body.get("baseUrl", "").strip(),
        body.get("projectKey", "").strip(),
        body.get("repoSlug", "").strip(),
        body.get("token", "").strip(),
        body.get("branch", "").strip(),
        body.get("path", "").strip().lstrip("/"),
    )
    if not path:
        return jsonify({"ok": False, "error": "파일 경로를 입력하세요."}), 200
    try:
        params = {}
        if branch:
            params["at"] = f"refs/heads/{branch}"
        resp = bitbucket_get(
            base_url,
            repo_root(base_url, project_key, repo_slug) + "/raw/" + path,
            token,
            params=params,
        )
        # resp.text 는 안 된다 — 서버가 Content-Type에 charset을 안 적어 보내면
        # requests가 HTTP 옛 기본값(ISO-8859-1)로 잘못 디코딩해서, 한글 주석 있는
        # 소스 파일이 깨져 나온다(실제로 이 문제로 한 번 걸렸다). raw bytes를
        # 직접 UTF-8로 디코드한다 — 이 저장소 소스는 다 UTF-8이다.
        text = resp.content.decode("utf-8", errors="replace")
        return jsonify({"ok": True, "content": text, "bytes": len(resp.content)})
    except ApiError as e:
        return jsonify({"ok": False, "error": str(e)}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5055, debug=True)
