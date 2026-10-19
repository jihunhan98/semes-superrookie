"use client";

import { useEffect, useRef, useState } from "react";
import ArtifactEvidence from "./ArtifactEvidence";
import MermaidDiagram from "./MermaidDiagram";
import AutoGrowTextarea from "./AutoGrowTextarea";
import { confirmArtifact, getArtifact, regenerateArtifact, type ArtifactDetail, type ArtifactTypeSlug } from "../lib/api";

export const ARTIFACT_LABELS: Record<ArtifactTypeSlug, string> = { voc: "SWVOC", functional: "기능 요구사항", nonfunctional: "비기능 요구사항", "detail-design": "Detail Design" };
export const ARTIFACT_TYPES = Object.keys(ARTIFACT_LABELS) as ArtifactTypeSlug[];
const SCENARIO_LABEL: Record<string, string> = { BASIC: "기본 동작", VARIANT: "변형 동작", EXCEPTION: "예외 동작" };
type Content = Record<string, unknown>;
type Scenario = { type: string; precondition: string | null; scenario: string | null; postcondition: string | null; applicability?: string; reason?: string | null };
function value(content: Content, key: string) { const current = content[key]; return typeof current === "string" ? current : ""; }
function TextField({ label, current, onChange, rows = 3, maxHeight }: { label: string; current: string; onChange: (value: string) => void; rows?: number; maxHeight?: number }) { return <label className="artifact-field"><span>{label}</span><AutoGrowTextarea aria-label={label} rows={rows} value={current} onChange={onChange} maxHeight={maxHeight} /></label>; }

type Props = { projectId: number; requirementId: number; issueKey: string; type: ArtifactTypeSlug; userId: number; onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void; onSaved?: () => void; onDocument?: (doc: ArtifactDetail) => void };
export default function ArtifactReviewForm({ projectId, requirementId, issueKey, type, userId, ...callbacks }: Props) {
  const callbacksRef = useRef(callbacks); callbacksRef.current = callbacks;
  const [content, setContent] = useState<Content | null>(null);
  const [baseline, setBaseline] = useState("");
  const [state, setState] = useState("DRAFT");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = content !== null && JSON.stringify(content) !== baseline;
  useEffect(() => { callbacksRef.current.onDirtyChange?.(dirty); }, [dirty]);
  useEffect(() => { callbacksRef.current.onBusyChange?.(saving); }, [saving]);
  useEffect(() => {
    let cancelled = false;
    setContent(null); setError(null); setNotice(null); setReason("");
    getArtifact(projectId, requirementId, issueKey, type, userId).then(doc => {
      if (cancelled) return;
      setContent(doc.content); setBaseline(JSON.stringify(doc.content)); setState(doc.state); callbacksRef.current.onDocument?.(doc);
    }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "산출물을 불러오지 못했습니다."); });
    return () => { cancelled = true; };
  }, [projectId, requirementId, issueKey, type, userId]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty || saving) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty, saving]);
  function setField(key: string, next: unknown) { setContent(current => ({ ...(current ?? {}), [key]: next })); setNotice(null); }
  function scenarios(): Scenario[] { return Array.isArray(content?.scenarios) ? content.scenarios as Scenario[] : []; }
  function updateScenario(index: number, key: keyof Scenario, next: string) { setField("scenarios", scenarios().map((row, i) => i === index ? { ...row, [key]: next } : row)); }
  async function submit(regenerate: boolean) {
    if (!content || saving) return;
    if (regenerate && dirty && !window.confirm("저장하지 않은 수정 내용이 있습니다. 수정 내용을 버리고 AI 재검토를 요청할까요?")) return;
    setSaving(true); setError(null); setNotice(null);
    try {
      const doc = regenerate
        ? await regenerateArtifact(projectId, requirementId, issueKey, type, { userId, reason })
        : await confirmArtifact(projectId, requirementId, issueKey, type, { userId, content });
      setContent(doc.content); setBaseline(JSON.stringify(doc.content)); setState(doc.state);
      callbacksRef.current.onDirtyChange?.(false); callbacksRef.current.onDocument?.(doc); callbacksRef.current.onSaved?.();
      setNotice(regenerate ? "AI 재검토 결과를 불러왔습니다. 내용을 확인해 주세요." : "수정 내용을 저장하고 검토를 완료했습니다.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "저장하지 못했습니다."); }
    finally { setSaving(false); }
  }
  if (!content) return <div className="jira-loading" role="status">{error ? <p className="lmsg err">{error}</p> : "산출물을 불러오는 중…"}</div>;
  return <div className="jira-artifact-form" aria-busy={saving}>
    {error && <p className="lmsg err" role="alert">{error}</p>}
    <fieldset disabled={saving} className="jira-form-fields">
      <div className="artifact-form">
      {type === "voc" && <div className="artifact-form-grid"><TextField label="요청자" current={value(content, "requester")} onChange={(next) => setField("requester", next)} rows={2} /><TextField label="요청사항" current={value(content, "requestContent")} onChange={(next) => setField("requestContent", next)} rows={6} /><TextField label="특이사항" current={value(content, "specialNotes")} onChange={(next) => setField("specialNotes", next)} rows={4} /></div>}
      {(type === "functional" || type === "nonfunctional") && <><div className="artifact-form-grid"><TextField label="개요" current={value(content, "overview")} onChange={(next) => setField("overview", next)} rows={4} /><TextField label="제약사항" current={value(content, "constraintsNote")} onChange={(next) => setField("constraintsNote", next)} rows={4} /></div><div className="scenario-grid">{scenarios().map((row, index) => <article key={`${row.type}-${index}`} className="scenario-card"><div className="scenario-card-title"><span>{String(index + 1).padStart(2, "0")}</span><b>{SCENARIO_LABEL[row.type] ?? row.type}</b></div><TextField label="선행조건" current={row.precondition ?? ""} onChange={(next) => updateScenario(index, "precondition", next)} /><TextField label="시나리오" current={row.scenario ?? ""} onChange={(next) => updateScenario(index, "scenario", next)} rows={5} /><TextField label="후행조건" current={row.postcondition ?? ""} onChange={(next) => updateScenario(index, "postcondition", next)} /></article>)}</div></>}
      {type === "detail-design" && <><TextField label="설명" current={value(content, "description")} onChange={(next) => setField("description", next)} rows={5} /><div className="diagram-editor-grid"><section><TextField label="Class Diagram · Mermaid 원문" current={value(content, "classDiagram")} onChange={(next) => setField("classDiagram", next)} rows={10} maxHeight={420} />{value(content, "classDiagram") && <MermaidDiagram code={value(content, "classDiagram")} copyable label="Class Diagram 미리보기" />}</section><section><TextField label="변경 전 Sequence Diagram · 설계 제안" current={value(content, "sequenceDiagramAsIs")} onChange={(next) => setField("sequenceDiagramAsIs", next)} rows={10} maxHeight={420} />{value(content, "sequenceDiagramAsIs") && <MermaidDiagram code={value(content, "sequenceDiagramAsIs")} copyable label="변경 전 미리보기" />}</section><section><TextField label="변경 후 Sequence Diagram · 설계 제안" current={value(content, "sequenceDiagramToBe")} onChange={(next) => setField("sequenceDiagramToBe", next)} rows={10} maxHeight={420} />{value(content, "sequenceDiagramToBe") && <MermaidDiagram code={value(content, "sequenceDiagramToBe")} copyable label="변경 후 미리보기" />}</section></div></>}
      </div>
      <details className="jira-evidence"><summary>요구사항 근거</summary><ArtifactEvidence content={content} /></details>
      <details className="jira-regenerate"><summary>AI에게 다시 검토 요청</summary><label>수정하거나 더 확인할 내용<input value={reason} onChange={event => setReason(event.target.value)} placeholder="재검토할 내용을 입력해 주세요" /></label><button className="btn" type="button" onClick={() => submit(true)} disabled={saving}>AI 재검토</button></details>
    </fieldset>
    <footer className="jira-editor-actions"><span aria-live="polite">{notice ?? (dirty ? "저장하지 않은 변경사항이 있습니다." : state === "CONFIRMED" ? "검토 완료된 산출물입니다." : "초안 내용을 확인하고 검토를 완료해 주세요.")}</span><button className="btn prim" onClick={() => submit(false)} disabled={saving}>{saving ? "처리 중…" : "저장 및 검토 완료"}</button></footer>
  </div>;
}
