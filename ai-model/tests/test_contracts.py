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


def test_amr_matching_detects_missing_distance_endpoints_and_empty_candidate_policy():
    text = ("AMR 매칭 시 IDLE 상태이며 SoC 30% 이상인 AMR 중 맨해튼 거리 기준 최단 경로에 "
            "있는 AMR을 선택한다. SoC 높은 순으로 정한다.")
    findings = rules.detect(text)
    reasons = " ".join(row.reason for row in findings)
    assert "출발점과 도착점" in reasons
    assert "한 대도 없을 때" in reasons
    assert "최종 선택 기준" in reasons

def test_known_requirement_reference_is_not_flagged():
    text = "req-ta-01과 동일한 순서로 처리한다."
    findings = rules.detect(text, [{"reqKey": "REQ-TA-01", "content": "SoC 높은 순"}])
    assert not any(row.finding_type == rules.T_REFERENCE for row in findings)

def test_split_quotes_are_grounded():
    content = "운영자가 조건을 설정한다. 시스템은 AMR을 선택한다."
    body = client.post("/split", json={"content": content}).json()
    assert body["issues"]
    assert all(row["quote"] in content for row in body["issues"])


def test_amr_matching_is_one_cohesive_issue_with_business_title():
    content = ("AMR 매칭 시 IDLE 상태이며 SoC 최소값 이상인 AMR 중 맨해튼 거리 기준으로 선택한다. "
               "거리가 같으면 SoC 높은 순으로 정한다.")
    body = client.post("/split", json={"content": content}).json()
    assert body["issues"] == [{"title": "AMR 후보 선정 및 매칭 우선순위", "quote": content}]

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
    assert "확인되지 않음" in content["sequenceDiagramAsIs"]
    assert "요구사항 검토자" in content["sequenceDiagramToBe"]
    assert "TargetService" not in content["sequenceDiagramToBe"]


def test_amr_detail_design_is_grounded_in_matching_requirement():
    requirement = ("AMR 매칭 시 IDLE 상태이며 SoC 최소값 이상인 AMR 중 맵 경로상 "
                   "맨해튼 거리 기준 최단 경로에 있는 AMR을 선택한다. 처리 우선순위는 "
                   "req-ta-01과 동일하게 SoC 높은 순으로 정한다.")
    content = artifacts.generate_v2("detail-design", "AMR 매칭", requirement, requirement)
    diagrams = content["classDiagram"] + content["sequenceDiagramToBe"]
    assert all(term in diagrams for term in ("AMR후보", "맵경로", "맨해튼", "IDLE", "SoC"))
    assert "업무요청" not in diagrams
    assert "현재 처리 결과" not in diagrams
    assert "확인되지 않음" in content["sequenceDiagramAsIs"]
