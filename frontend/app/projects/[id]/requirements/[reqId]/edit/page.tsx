"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AiFindings from "../../../../../components/AiFindings";
import Header from "../../../../../components/Header";
import Modal from "../../../../../components/Modal";
import ProjectSidebar from "../../../../../components/ProjectSidebar";
import WorkflowStepper from "../../../../../components/WorkflowStepper";
import {
  confirmRequirement, diffAnalyzeRequirement, getProject, getRequirement, holdRequirement,
  listRequirementAttachments, recordConsensus, uploadRequirementAttachment,
  type ProjectDetail, type RequirementAttachment, type RequirementDetail,
} from "../../../../../lib/api";
import { getCurrentUser } from "../../../../../lib/session";

const METHODS = ["대면 미팅", "화상회의", "유선", "메일"];
function today() { return new Date().toISOString().slice(0, 10); }
function size(bytes: number) { return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

export default function RequirementEditPage() {
  const router = useRouter(); const search = useSearchParams(); const params = useParams<{ id: string; reqId: string }>();
  const projectId = Number(params.id); const requirementId = Number(params.reqId);
  const [project, setProject] = useState<ProjectDetail | null>(null); const [requirement, setRequirement] = useState<RequirementDetail | null>(null);
  const [baseContent, setBaseContent] = useState(""); const [draft, setDraft] = useState(""); const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<RequirementAttachment[]>([]); const [sidebarOpen, setSidebarOpen] = useState(true);
  const [analyzing, setAnalyzing] = useState(false); const [uploading, setUploading] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null); const [confirmOpen, setConfirmOpen] = useState(false); const fileRef = useRef<HTMLInputElement>(null);
  const [method, setMethod] = useState(METHODS[0]); const [contact, setContact] = useState(""); const [agreedOn, setAgreedOn] = useState(today());
  const [agreement, setAgreement] = useState(""); const [versionTitle, setVersionTitle] = useState("");

  useEffect(() => {
    const user = getCurrentUser(); if (!user) { router.replace("/login"); return; }
    Promise.all([getProject(projectId, user.id), getRequirement(projectId, requirementId, user.id), listRequirementAttachments(projectId, requirementId, user.id)])
      .then(([loadedProject, loadedRequirement, files]) => {
        setProject(loadedProject); setRequirement(loadedRequirement); setBaseContent(loadedRequirement.content);
        setDraft(loadedRequirement.aiDraftContent || loadedRequirement.content); setAttachments(files);
        if (loadedRequirement.consensus) { setMethod(loadedRequirement.consensus.method); setContact(loadedRequirement.consensus.customerContact); setAgreement(loadedRequirement.consensus.note ?? ""); }
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "요구사항을 불러오지 못했습니다."));
  }, [projectId, requirementId, router]);

  async function analyze() {
    const user = getCurrentUser(); if (!user) return; setAnalyzing(true); setError(null);
    try { const updated = await diffAnalyzeRequirement(projectId, requirementId, { userId: user.id, content: draft, reason: prompt.trim() }); setRequirement(updated); setDraft(updated.aiDraftContent); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "AI 분석에 실패했습니다. 본문은 계속 수정할 수 있습니다."); }
    finally { setAnalyzing(false); }
  }

  async function upload(files: FileList | null) {
    const user = getCurrentUser(); if (!user || !files?.length) return; setUploading(true); setError(null);
    try { for (const file of Array.from(files)) { const saved = await uploadRequirementAttachment(projectId, requirementId, user.id, file); setAttachments((current) => [...current, saved]); } }
    catch (cause) { setError(cause instanceof Error ? cause.message : "첨부 파일을 저장하지 못했습니다."); }
    finally { setUploading(false); }
  }

  async function hold() {
    const user = getCurrentUser(); if (!user) return; setBusy(true); setError(null);
    try { await holdRequirement(projectId, requirementId, user.id); router.push(`/projects/${projectId}/requirements/${requirementId}`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "보류하지 못했습니다."); setBusy(false); }
  }

  async function agreeAndConfirm() {
    const user = getCurrentUser(); if (!user) return;
    if (!contact.trim() || !agreement.trim() || !versionTitle.trim()) { setError("고객 담당자, 합의 내용, 변경 요약을 모두 입력하세요."); return; }
    setBusy(true); setError(null);
    try {
      const withConsensus = await recordConsensus(projectId, requirementId, { userId: user.id, method, customerContact: contact.trim(), agreedOn, note: agreement.trim(), agreedContent: draft });
      await confirmRequirement(projectId, requirementId, { userId: user.id, content: draft, title: versionTitle.trim(), consensusId: withConsensus.consensus?.id });
      router.push(`/projects/${projectId}/requirements/${requirementId}/issues`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "요구사항을 확정하지 못했습니다."); setBusy(false); }
  }

  if (!project || !requirement) return <div className="appshell"><Header /><main className="main"><div className="placeholder">요구사항을 불러오는 중…</div>{error && <p className="lmsg err">{error}</p>}</main></div>;
  const dirty = draft !== baseContent; const requiredCount = requirement.findings.filter((finding) => !finding.findingType.includes("참고")).length;

  return <div className="appshell"><Header projectName={project.name} onToggleSidebar={() => setSidebarOpen((open) => !open)} /><div className="body">
    {sidebarOpen && <ProjectSidebar projectId={projectId} projectName={project.name} active="requirements" />}
    <main className="main requirement-review-page">
      <WorkflowStepper step={2} />
      {search.get("attachmentWarning") && <p className="lmsg err">{search.get("attachmentWarning")}</p>}
      <div className="crumb"><Link href={`/projects/${projectId}/requirements`}>요구사항</Link> / <Link href={`/projects/${projectId}/requirements/${requirementId}`}>{requirement.reqKey}</Link> / 검출 결과 수정</div>
      <section className="stage-heading"><div><span className="section-kicker">2단계</span><h1>문제가 된 구절만 확인하고 확정하세요</h1><p>원문 위치, 필요한 질문, 최종 본문을 한 화면에 모았습니다.</p></div><div className="review-metrics"><span><b>{requiredCount}</b>필수 질문</span><span><b>{requirement.findings.length - requiredCount}</b>참고 의견</span></div></section>
      <section className="review-prompt"><div><b>추가로 반영할 내용</b><span>선택 · 비워두면 바뀐 문장만 다시 검토합니다.</span></div><input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="예: 재전송 담당자는 고객 운영팀으로 명시해줘" /><button className="btn" onClick={analyze} disabled={analyzing}>{analyzing ? "검토 중…" : "다시 검토"}</button></section>
      <div className="requirement-review-grid">
        <section className="review-findings-panel"><div className="pane-heading"><div><span>원문 내 검출 결과</span><small>필수 질문과 근거 부족 항목을 먼저 봅니다.</small></div><b>{requirement.findings.length}건</b></div><AiFindings content={draft} findings={requirement.findings} contentLabel="현재 본문" empty={<><b>확인을 요구하는 문제가 없습니다.</b><span>필요하면 본문을 직접 수정한 뒤 다시 분석하세요.</span></>} /></section>
        <section className="review-editor-panel"><div className="pane-heading"><div><span>확정될 본문</span><small>이 내용이 고객 합의 스냅샷과 새 버전에 그대로 저장됩니다.</small></div>{dirty && <b>수정됨</b>}</div><textarea className="reqta review-editor" value={draft} onChange={(event) => setDraft(event.target.value)} /><div className="editor-actions"><button className="btn sm" disabled={!dirty} onClick={() => setDraft(baseContent)}>원문으로 되돌리기</button><span>{requirement.version ? `현재 v${requirement.version} · 다음 v${requirement.nextVersion}` : `최초 확정 v${requirement.nextVersion}`}</span></div></section>
      </div>
      <section className="evidence-strip"><div><b>프로젝트 근거 자료</b><span>TXT·PDF·DOCX 텍스트는 검색 근거로, 이미지는 원본으로 Oracle에 보존됩니다.</span></div><input ref={fileRef} type="file" multiple accept=".txt,.pdf,.docx,image/*" hidden onChange={(event) => { upload(event.target.files); event.target.value = ""; }} /><button className="btn sm" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? "업로드 중…" : "자료 추가"}</button>{attachments.length > 0 && <ul>{attachments.map((file) => <li key={file.id}><span>📎 {file.fileName}</span><small>{size(file.fileSize)} · {file.extractionState === "EXTRACTED" ? "텍스트 추출 완료" : "원본 보존"}</small></li>)}</ul>}</section>
      {error && <p className="lmsg err" aria-live="polite">{error}</p>}
      <footer className="stage-action-bar"><div><b>확정할 준비가 되었나요?</b><span>확정 버튼에서 고객 합의를 기록한 뒤 이슈 자동 도출로 이어집니다.</span></div><button className="btn" onClick={hold} disabled={busy}>보류</button><button className="btn prim" onClick={() => { setError(null); setConfirmOpen(true); }} disabled={busy || !draft.trim()}>요구사항 확정</button></footer>
    </main>
  </div>
  {confirmOpen && <Modal title="고객 합의 기록 및 요구사항 확정" icon="✓" onClose={() => !busy && setConfirmOpen(false)} wide><div className="consensus-dialog-intro"><b>합의 기록 없이는 최종 확정할 수 없습니다.</b><span>아래 본문 스냅샷과 기록자가 버전 이력에 함께 보존됩니다.</span></div><div className="consensus-dialog-grid"><label><span>합의 방법</span><select value={method} onChange={(event) => setMethod(event.target.value)}>{METHODS.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>고객 담당자</span><input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="김고객 책임" /></label><label><span>합의일</span><input type="date" value={agreedOn} onChange={(event) => setAgreedOn(event.target.value)} /></label><label className="wide"><span>합의 내용</span><textarea rows={4} value={agreement} onChange={(event) => setAgreement(event.target.value)} placeholder="확정 본문과 예외 처리 방향에 동의함" /></label><label className="wide"><span>변경 요약 · 버전 이력 제목</span><input value={versionTitle} onChange={(event) => setVersionTitle(event.target.value)} placeholder="고객 합의 반영 및 알림 실패 처리 확정" /></label></div><div className="consensus-snapshot"><span>합의 당시 본문 스냅샷</span><p>{draft}</p></div>{error && <p className="lmsg err">{error}</p>}<div className="modal-actions"><button className="btn" onClick={() => setConfirmOpen(false)} disabled={busy}>취소</button><button className="btn prim" onClick={agreeAndConfirm} disabled={busy}>{busy ? "기록하고 확정하는 중…" : "합의 기록 후 확정"}</button></div></Modal>}
  </div>;
}
