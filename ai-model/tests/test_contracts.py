from fastapi.testclient import TestClient
from main import app
import artifacts, rules

client = TestClient(app)

def test_health_does_not_expose_secret():
    data = client.get("/health").json()
    assert "key" not in str(data).lower()

def test_no_invented_policy_replacement():
    text = "가용한 AMR 중 가장 가까운 장비를 신속히 선택한다."
    draft = rules.build_draft(text, rules.detect(text))
    assert draft == text
    assert "5분" not in draft and "맨해튼" not in draft and "IDLE" not in draft

def test_split_quotes_are_grounded():
    content = "운영자가 조건을 설정한다. 시스템은 AMR을 선택한다."
    body = client.post("/split", json={"content": content}).json()
    assert body["issues"]
    assert all(row["quote"] in content for row in body["issues"])

def test_v2_scenario_shape():
    content = artifacts.generate_v2("functional", "AMR 선택", "요구사항에 따라 AMR을 선택한다.")
    assert [row["type"] for row in content["scenarios"]] == ["BASIC", "VARIANT", "EXCEPTION"]
