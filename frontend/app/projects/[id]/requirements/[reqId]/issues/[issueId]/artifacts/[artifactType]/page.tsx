"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ArtifactEvidence from "../../../../../../../../components/ArtifactEvidence";
import { devId } from "../../../../../../../../lib/insights";
import Header from "../../../../../../../../components/Header";
import MermaidDiagram from "../../../../../../../../components/MermaidDiagram";
import WorkflowStepper from "../../../../../../../../components/WorkflowStepper";
import AutoGrowTextarea from "../../../../../../../../components/AutoGrowTextarea";
import { getCurrentUser } from "../../../../../../../../lib/session";
import { getCurrentBundle } from "../../../../../../../../lib/api/v2";
import { confirmArtifact, getArtifact, regenerateArtifact, type ArtifactTypeSlug } from "../../../../../../../../lib/api";

const LABELS: Record<ArtifactTypeSlug, string> = { voc: "SWVOC", functional: "기능 요구사항", nonfunctional: "비기능 요구사항", "detail-design": "Detail Design" };
const SCENARIO_LABEL: Record<string, string> = { BASIC: "기본 동작", VARIANT: "변형 동작", EXCEPTION: "예외 동작" };
type Content = Record<string, unknown>;
type Scenario = { type: string; precondition: string | null; scenario: string | null; postcondition: string | null; applicability?: string; reason?: string | null };

function value(content: Content, key: string) { const current = content[key]; return typeof current === "string" ? current : ""; }
function TextField({ label, current, onChange, rows = 3, maxHeight }: { label: string; current: string; onChange: (value: string) => void; rows?: number; maxHeight?: number }) { return <label className="artifact-field"><span>{label}</span><AutoGrowTextarea rows={rows} value={current} onChange={onChange} maxHeight={maxHeight} /></label>; }

export default function ArtifactEditor() {
  const params = useParams<{ id: string; reqId: string; issueId: string; artifactType: ArtifactTypeSlug }>(); const router = useRouter();
  const projectId = Number(params.id); const requirementId = Number(params.reqId); const issueId = Number(params.issueId); const type = params.artifactType;
  const [issueKey, setIssueKey] = useState(""); const [content, setContent] = useState<Content | null>(null);
  const [state, setState] = useState("DRAFT"); const [reason, setReason] = useState(""); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);

  useEffect(() => { const user = getCurrentUser(); if (!user) { router.replace("/login"); return; } getCurrentBundle(projectId, requirementId, user.id).then((bundle) => { const issue = bundle.issues.find((item) => item.id === issueId); if (!issue) throw new Error("개발 이슈를 찾을 수 없습니다."); setIssueKey(issue.issueKey); return getArtifact(projectId, requirementId, issue.issueKey, type, user.id); }).then((doc) => { setContent(doc.content); setState(doc.state); }).catch((cause) => setError(cause instanceof Error ? cause.message : "산출물을 불러오지 못했습니다.")); }, [projectId, requirementId, issueId, type, router]);

  function setField(key: string, next: unknown) { setContent((current) => ({ ...(current ?? {}), [key]: next })); }
  function scenarios(): Scenario[] { const rows = content?.scenarios; return Array.isArray(rows) ? rows as Scenario[] : []; }
  function updateScenario(index: number, key: keyof Scenario, next: string) { const rows = scenarios().map((row, rowIndex) => rowIndex === index ? { ...row, [key]: next } : row); setField("scenarios", rows); }
  async function save() { const user = getCurrentUser(); if (!user || !content) return; setSaving(true); setError(null); try { const doc = await confirmArtifact(projectId, requirementId, issueKey, type, { userId: user.id, content }); setState(doc.state); setContent(doc.content); } catch (cause) { setError(cause instanceof Error ? cause.message : "저장하지 못했습니다."); } finally { setSaving(false); } }
  async function regenerate() { const user = getCurrentUser(); if (!user) return; setSaving(true); setError(null); try { const doc = await regenerateArtifact(projectId, requirementId, issueKey, type, { userId: user.id, reason }); setContent(doc.content); setState(doc.state); } catch (cause) { setError(cause instanceof Error ? cause.message : "재생성하지 못했습니다."); } finally { setSaving(false); } }

  if (!content) return <div className="appshell"><Header /><main className="main"><div className="placeholder">산출물을 불러오는 중…</div>{error && <p className="lmsg err">{error}</p>}</main></div>;

  return <div className="appshell"><Header /><main className="main artifact-editor-page"><WorkflowStepper step={4} />
    <div className="crumb"><Link href={`/projects/${projectId}/requirements/${requirementId}/review?issue=${issueId}`}>검토 작업공간</Link> / {devId(issueId)} / {LABELS[type]}</div>
    <section className="artifact-editor-head"><div><span className="section-kicker">산출물 검토</span><h1>{LABELS[type]}</h1><p>위에서 아래로 읽으며 필요한 내용만 수정하세요. 긴 입력은 내용에 맞춰 자동으로 펼쳐집니다.</p></div><div className="artifact-status"><span className={state.toLowerCase()}>{state === "CONFIRMED" ? "확정" : "초안"}</span></div></section>
    {error && <p className="lmsg err">{error}</p>}

    <section className="artifact-regenerate"><div><b>AI에게 추가로 검토 요청</b><span>현재 내용은 이력으로 보존됩니다.</span></div><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="수정하거나 더 확인할 내용을 입력해 주세요" /><button className="btn" onClick={regenerate} disabled={saving}>{saving ? "AI가 다시 검토 중이에요…" : "AI 재검토"}</button></section>

    <ArtifactEvidence content={content} projectId={projectId}/><section className="artifact-form">
      {type === "voc" && <div className="artifact-form-grid"><TextField label="요청자" current={value(content, "requester")} onChange={(next) => setField("requester", next)} rows={2} /><TextField label="요청사항" current={value(content, "requestContent")} onChange={(next) => setField("requestContent", next)} rows={6} /><TextField label="특이사항" current={value(content, "specialNotes")} onChange={(next) => setField("specialNotes", next)} rows={4} /></div>}
      {(type === "functional" || type === "nonfunctional") && <><div className="artifact-form-grid"><TextField label="개요" current={value(content, "overview")} onChange={(next) => setField("overview", next)} rows={4} /><TextField label="제약사항" current={value(content, "constraintsNote")} onChange={(next) => setField("constraintsNote", next)} rows={4} /></div><div className="scenario-grid">{scenarios().map((row, index) => <article key={`${row.type}-${index}`} className="scenario-card"><div className="scenario-card-title"><span>{String(index + 1).padStart(2, "0")}</span><b>{SCENARIO_LABEL[row.type] ?? row.type}</b></div><TextField label="선행조건" current={row.precondition ?? ""} onChange={(next) => updateScenario(index, "precondition", next)} /><TextField label="시나리오" current={row.scenario ?? ""} onChange={(next) => updateScenario(index, "scenario", next)} rows={5} /><TextField label="후행조건" current={row.postcondition ?? ""} onChange={(next) => updateScenario(index, "postcondition", next)} /></article>)}</div></>}
      {type === "detail-design" && <><TextField label="설명" current={value(content, "description")} onChange={(next) => setField("description", next)} rows={5} /><div className="diagram-editor-grid"><section><TextField label="Class Diagram · Mermaid 원문" current={value(content, "classDiagram")} onChange={(next) => setField("classDiagram", next)} rows={10} maxHeight={420} />{value(content, "classDiagram") && <MermaidDiagram code={value(content, "classDiagram")} copyable label="Class Diagram 미리보기" />}</section><section><TextField label="변경 전 Sequence Diagram · 실제 클래스" current={value(content, "sequenceDiagramAsIs")} onChange={(next) => setField("sequenceDiagramAsIs", next)} rows={10} maxHeight={420} />{value(content, "sequenceDiagramAsIs") && <MermaidDiagram code={value(content, "sequenceDiagramAsIs")} copyable label="변경 전 미리보기" />}</section><section><TextField label="변경 후 Sequence Diagram · 실제 클래스" current={value(content, "sequenceDiagramToBe")} onChange={(next) => setField("sequenceDiagramToBe", next)} rows={10} maxHeight={420} />{value(content, "sequenceDiagramToBe") && <MermaidDiagram code={value(content, "sequenceDiagramToBe")} copyable label="변경 후 미리보기" />}</section></div></>}
    </section>
    <footer className="artifact-save-bar"><Link className="btn" href={`/projects/${projectId}/requirements/${requirementId}/review?issue=${issueId}`}>검토 화면으로</Link><button className="btn prim" onClick={save} disabled={saving}>{saving ? "저장 중…" : "저장하고 개별 확정"}</button></footer>
  </main></div>;
}
