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

def test_missing_soc_value_and_unknown_requirement_are_required_findings():
    text = "SoC 최소값 이상인 AMR을 선택하고 req-ta-01과 동일한 순서로 처리한다."
    findings = rules.detect(text, [{"reqKey": "REQ-OTHER", "content": "다른 기준"}])
    assert any(row.finding_type == rules.T_QUANT and row.target_span == "SoC 최소값" for row in findings)
    assert any(row.finding_type == rules.T_REFERENCE and row.target_span == "req-ta-01" for row in findings)
    assert rules.build_draft(text, findings) == text

def test_known_requirement_reference_is_not_flagged():
    text = "req-ta-01과 동일한 순서로 처리한다."
    findings = rules.detect(text, [{"reqKey": "REQ-TA-01", "content": "SoC 높은 순"}])
    assert not any(row.finding_type == rules.T_REFERENCE for row in findings)

def test_split_quotes_are_grounded():
    content = "운영자가 조건을 설정한다. 시스템은 AMR을 선택한다."
    body = client.post("/split", json={"content": content}).json()
    assert body["issues"]
    assert all(row["quote"] in content for row in body["issues"])

def test_v2_scenario_shape():
    content = artifacts.generate_v2("functional", "AMR 선택", "요구사항에 따라 AMR을 선택한다.")
    assert [row["type"] for row in content["scenarios"]] == ["BASIC", "VARIANT", "EXCEPTION"]

def test_batch_reports_partial_failure_without_dropping_successes():
    body = client.post("/v2/artifacts/batch", json={
        "issueTitle": "알림 처리", "issueQuote": "시스템은 알림을 전송한다.",
        "requirementContent": "시스템은 알림을 전송한다.",
        "requestedTypes": ["VOC", "UNKNOWN", "DETAIL_DESIGN"],
    }).json()
    assert [row["status"] for row in body["outputs"]] == ["SUCCEEDED", "FAILED", "SUCCEEDED"]
    assert body["outputs"][0]["content"] is not None
    assert body["outputs"][1]["errors"] == ["UNSUPPORTED_TYPE"]

def test_detail_design_fallback_uses_business_language_mermaid():
    content = artifacts.generate_v2("detail-design", "주문 승인 알림", "승인되면 배차 담당자에게 알린다")
    assert content["classDiagram"].startswith("classDiagram")
    assert "업무 요청자" in content["sequenceDiagramAsIs"]
    assert "업무 담당자" in content["sequenceDiagramToBe"]
    assert "TargetService" not in content["sequenceDiagramToBe"]
