"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AutoGrowTextarea from "../../../../../../../components/AutoGrowTextarea";
import Header from "../../../../../../../components/Header";
import MermaidDiagram from "../../../../../../../components/MermaidDiagram";
import ProjectSidebar from "../../../../../../../components/ProjectSidebar";
import {
  mockIssueFor,
  type BehaviorRow,
  type ClassNode,
  type DetailDesignContent,
  type FunctionalContent,
  type NonFunctionalContent,
  type VocContent,
} from "../../../../../../../lib/artifactsMock";
import {
  confirmArtifact,
  getArtifact,
  getProject,
  getRequirement,
  listDevIssues,
  regenerateArtifact,
  type ArtifactTypeSlug,
  type DevIssue,
  type ProjectDetail,
  type RequirementDetail,
} from "../../../../../../../lib/api";
import { getCurrentUser } from "../../../../../../../lib/session";

const TITLES: Record<string, { icon: string; label: string }> = {
  voc: { icon: "🗣", label: "SWVOC" },
  functional: { icon: "⚙", label: "기능 요구사항" },
  nonfunctional: { icon: "🛡", label: "비기능 요구사항" },
  "detail-design": { icon: "📐", label: "Detail Design" },
};

/** /analyze·/split과 같은 배지 의미. */
const ENGINE_LABEL: Record<string, string> = {
  "llm-api": "사내 LLM",
  rule: "규칙 기반",
  unavailable: "AI 미응답",
};

/** 편집 리스트 행의 색상 — 이슈별 순환색과는 무관한 중립색이라 항상 같은 값을 쓴다. */
const NEUTRAL_ROW_COLOR = { "--m": "var(--line)", "--ms": "var(--accent-soft)" } as CSSProperties;

function BehaviorTable({
  rows,
  onChangeRow,
}: {
  rows: BehaviorRow[];
  onChangeRow: (originalIndex: number, content: string) => void;
}) {
  const indexed = rows.map((r, i) => ({ ...r, i }));
  const base = indexed.filter((r) => r.type === "기본");
  const exc = indexed.filter((r) => r.type === "예외");
  return (
    <table className="behtable">
      <thead>
        <tr>
          <th style={{ width: 100 }}>동작 유형</th>
          <th style={{ width: 100 }}>항목</th>
          <th>내용</th>
        </tr>
      </thead>
      <tbody>
        {base.map((r, i) => (
          <tr key={`base-${r.i}`}>
            {i === 0 && (
              <td rowSpan={base.length} className="grp base">
                기본
                <span className="sub">정상 흐름</span>
              </td>
            )}
            <td>{r.item}</td>
            <td>
              <AutoGrowTextarea className="behta" rows={1} value={r.content} onChange={(v) => onChangeRow(r.i, v)} />
            </td>
          </tr>
        ))}
        {exc.map((r, i) => (
          <tr key={`exc-${r.i}`}>
            {i === 0 && (
              <td rowSpan={exc.length} className="grp exc">
                예외
                <span className="sub">오류·실패</span>
              </td>
            )}
            <td>{r.item}</td>
            <td>
              <AutoGrowTextarea className="behta" rows={1} value={r.content} onChange={(v) => onChangeRow(r.i, v)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function VocBody({ content, onChange }: { content: VocContent; onChange: (patch: Partial<VocContent>) => void }) {
  return (
    <>
      <div className="fieldlab" style={{ marginTop: 0 }}>설명</div>
      <AutoGrowTextarea className="reqta" value={content.description} onChange={(v) => onChange({ description: v })} />
      <div className="fieldlab">1. 요청사항</div>
      <AutoGrowTextarea className="reqta" value={content.request} onChange={(v) => onChange({ request: v })} />
      <div className="fieldlab">2. 특이사항</div>
      <AutoGrowTextarea className="reqta" value={content.notes} onChange={(v) => onChange({ notes: v })} />
    </>
  );
}

function FunctionalBody({
  content,
  onChange,
  nonFunctional,
}: {
  content: FunctionalContent | NonFunctionalContent;
  onChange: (patch: Partial<FunctionalContent | NonFunctionalContent>) => void;
  nonFunctional?: boolean;
}) {
  function updateBehavior(i: number, value: string) {
    onChange({ behaviors: content.behaviors.map((b, idx) => (idx === i ? { ...b, content: value } : b)) });
  }

  return (
    <>
      <div className="fieldlab" style={{ marginTop: 0 }}>설명</div>
      <AutoGrowTextarea className="reqta" value={content.description} onChange={(v) => onChange({ description: v })} />
      <div className="fieldlab">1. 개요</div>
      <div className="ovbox">
        <div className="r">
          <span className="k">역할</span>
          <AutoGrowTextarea className="ovinput" rows={1} value={content.role} onChange={(v) => onChange({ role: v })} />
        </div>
        <div className="r">
          <span className="k">목적</span>
          <AutoGrowTextarea className="ovinput" rows={1} value={content.purpose} onChange={(v) => onChange({ purpose: v })} />
        </div>
      </div>
      <div className="fieldlab">2. 동작 정의</div>
      <BehaviorTable rows={content.behaviors} onChangeRow={updateBehavior} />
      {nonFunctional && (
        <>
          <div className="fieldlab">제약사항</div>
          <AutoGrowTextarea
            className="reqta"
            value={(content as NonFunctionalContent).constraints}
            onChange={(v) => onChange({ constraints: v } as Partial<NonFunctionalContent>)}
          />
        </>
      )}
    </>
  );
}

/** AS-IS/TO-BE를 나란히 보여주는 한 행 — Mermaid 코드 행과 실제 다이어그램 행에 둘 다 쓴다. */
function SeqPair({ title, asis, tobe }: { title: string; asis: ReactNode; tobe: ReactNode }) {
  return (
    <>
      <div className="fieldlab" style={{ marginTop: 0 }}>{title}</div>
      <div className="seqcols2">
        <div className="seqblock">{asis}</div>
        <div className="seqblock">{tobe}</div>
      </div>
    </>
  );
}

/** Mermaid 코드를 직접 편집하는 칸 — 편집하면 바로 밑 렌더링에도 그대로 반영된다. */
function SeqCodeColumn({
  label,
  code,
  onChange,
}: {
  label: string;
  code: string;
  onChange: (code: string) => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "ok" | "err">("idle");

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("ok");
    } catch {
      setCopyState("err");
    }
    setTimeout(() => setCopyState("idle"), 1500);
  }

  return (
    <>
      <div className="seqblockhd">
        {label}
        <button type="button" className="btn sm" style={{ marginLeft: "auto" }} onClick={onCopy}>
          {copyState === "ok" ? "복사됨" : copyState === "err" ? "복사 실패" : "복사"}
        </button>
      </div>
      <AutoGrowTextarea className="promptbox" style={{ margin: 0 }} value={code} onChange={onChange} spellCheck={false} />
    </>
  );
}

/** Class Diagram 편집 — 클래스별로 이름·필드 목록·변경 여부를 고치고, 추가·삭제한다. */
function ClassDiagramEditor({ nodes, onChange }: { nodes: ClassNode[]; onChange: (nodes: ClassNode[]) => void }) {
  function update(i: number, patch: Partial<ClassNode>) {
    onChange(nodes.map((n, idx) => (idx === i ? { ...n, ...patch } : n)));
  }
  function remove(i: number) {
    onChange(nodes.filter((_, idx) => idx !== i));
  }

  return (
    <div className="issue-list" style={{ marginTop: 0 }}>
      {nodes.map((n, i) => (
        <div key={i} className="issue-card" style={NEUTRAL_ROW_COLOR}>
          <div className="ibody">
            <div className="ttl">
              <input value={n.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="클래스 이름" />
              <label className="chkchip">
                <input type="checkbox" checked={!!n.changed} onChange={(e) => update(i, { changed: e.target.checked })} />
                변경됨
              </label>
              <button className="idel" onClick={() => remove(i)} aria-label="클래스 삭제">
                ✕
              </button>
            </div>
            <AutoGrowTextarea
              className="quotein"
              value={n.fields.join("\n")}
              onChange={(v) => update(i, { fields: v.split("\n") })}
              placeholder="필드·메서드 — 한 줄에 하나씩"
            />
          </div>
        </div>
      ))}
      <button type="button" className="addrow" onClick={() => onChange([...nodes, { name: "", fields: [] }])}>
        ＋ 클래스 추가
      </button>
    </div>
  );
}

function DetailDesignBody({
  content,
  onChange,
}: {
  content: DetailDesignContent;
  onChange: (patch: Partial<DetailDesignContent>) => void;
}) {
  return (
    <>
      <div className="fieldlab" style={{ marginTop: 0 }}>설명</div>
      <AutoGrowTextarea className="reqta" value={content.description} onChange={(v) => onChange({ description: v })} />

      <div className="ddsection">
        <div className="fieldlab" style={{ marginTop: 0 }}>Class Diagram — 영향 범위</div>
        <ClassDiagramEditor nodes={content.classDiagram} onChange={(classDiagram) => onChange({ classDiagram })} />
      </div>

      <div className="ddsection">
        <SeqPair
          title="Sequence Diagram — Mermaid 코드"
          asis={
            <SeqCodeColumn
              label="AS-IS"
              code={content.sequenceBeforeCode}
              onChange={(v) => onChange({ sequenceBeforeCode: v })}
            />
          }
          tobe={
            <SeqCodeColumn
              label="TO-BE"
              code={content.sequenceAfterCode}
              onChange={(v) => onChange({ sequenceAfterCode: v })}
            />
          }
        />
        <div style={{ marginTop: 16 }}>
          <SeqPair
            title="Sequence Diagram — 렌더링"
            asis={<MermaidDiagram code={content.sequenceBeforeCode} label="AS-IS" copyable />}
            tobe={<MermaidDiagram code={content.sequenceAfterCode} label="TO-BE" copyable />}
          />
        </div>
      </div>
    </>
  );
}

export default function ArtifactDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string; reqId: string; issueKey: string; artifactType: string }>();
  const projectId = Number(params.id);
  const requirementId = Number(params.reqId);
  const issueKey = params.issueKey;
  const artifactType = params.artifactType as ArtifactTypeSlug;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [req, setReq] = useState<RequirementDetail | null>(null);
  const [issues, setIssues] = useState<DevIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [artifactState, setArtifactState] = useState<"DRAFT" | "CONFIRMED">("DRAFT");
  const [engine, setEngine] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [regenNote, setRegenNote] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!Number.isFinite(projectId) || !Number.isFinite(requirementId)) return;

    Promise.all([
      getProject(projectId, user.id),
      getRequirement(projectId, requirementId, user.id),
      listDevIssues(projectId, requirementId, user.id),
    ])
      .then(([p, r, iss]) => {
        setProject(p);
        setReq(r);
        setIssues(iss);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "요구사항을 불러오지 못했습니다."));
  }, [projectId, requirementId, router]);

  // 이슈 목록을 받아 이 산출물이 어느 이슈 소속인지 안 뒤에야 불러올 수 있다.
  useEffect(() => {
    const user = getCurrentUser();
    if (!user || !issues || !TITLES[artifactType]) return;
    if (!issues.some((i) => i.issueKey === issueKey)) return;

    getArtifact(projectId, requirementId, issueKey, artifactType, user.id)
      .then((res) => {
        setContent(res.content);
        setArtifactState(res.state);
        setEngine(res.engine);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "산출물을 불러오지 못했습니다."));
  }, [projectId, requirementId, issueKey, artifactType, issues]);

  function patchContent(patch: Record<string, unknown>) {
    setContent((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function onRegenerate() {
    const user = getCurrentUser();
    if (!user) return;
    setRegenerating(true);
    setRegenError(null);
    try {
      const res = await regenerateArtifact(projectId, requirementId, issueKey, artifactType, {
        userId: user.id,
        reason: regenNote.trim(),
      });
      setContent(res.content);
      setArtifactState(res.state);
      setEngine(res.engine);
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : "AI 재생성에 실패했습니다.");
    } finally {
      setRegenerating(false);
    }
  }

  async function onConfirm() {
    const user = getCurrentUser();
    if (!user || !content) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await confirmArtifact(projectId, requirementId, issueKey, artifactType, {
        userId: user.id,
        content,
      });
      setContent(res.content);
      setArtifactState(res.state);
      setEngine(res.engine);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "확정에 실패했습니다.");
    } finally {
      setConfirming(false);
    }
  }

  if (error) {
    return (
      <div className="appshell">
        <Header />
        <main className="main">
          <p className="lmsg err">{error}</p>
        </main>
      </div>
    );
  }

  if (!project || !req || !issues) {
    return (
      <div className="appshell">
        <Header />
        <main className="main">
          <div className="placeholder">불러오는 중…</div>
        </main>
      </div>
    );
  }

  const realIdx = issues.findIndex((i) => i.issueKey === issueKey);
  const issue = realIdx < 0 ? null : mockIssueFor(issues[realIdx]);
  const meta = TITLES[artifactType];

  if (!issue || !meta) {
    return (
      <div className="appshell">
        <Header projectName={project.name} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <div className="body">
          {sidebarOpen && <ProjectSidebar projectId={project.id} projectName={project.name} active="artifacts" />}
          <main className="main">
            <p className="lmsg err">산출물을 찾을 수 없습니다.</p>
          </main>
        </div>
      </div>
    );
  }

  // Detail Design은 다이어그램 2열(AS-IS·TO-BE)이 들어가 다른 산출물보다 더 넓게 쓴다.
  const maxW = artifactType === "detail-design" ? 1200 : 900;

  return (
    <div className="appshell">
      <Header projectName={project.name} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="body">
        {sidebarOpen && <ProjectSidebar projectId={project.id} projectName={project.name} active="artifacts" />}
        <main className="main">
          <div className="crumb">
            <Link href={`/projects/${project.id}/artifacts`}>
              <b>산출물</b>
            </Link>{" "}
            / <Link href={`/projects/${project.id}/artifacts/${requirementId}`}>{req.reqKey}</Link> /{" "}
            <Link href={`/projects/${project.id}/artifacts/${requirementId}/issues/${issue.key}`}>{issue.key}</Link> /{" "}
            {meta.label}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
              {meta.icon} {meta.label} — {issue.title}
            </h1>
            <span
              className="lbl"
              style={{
                padding: "2px 11px",
                background: artifactState === "CONFIRMED" ? "var(--green-soft)" : "var(--surface-muted)",
                color: artifactState === "CONFIRMED" ? "var(--green)" : "var(--muted)",
              }}
            >
              {artifactState === "CONFIRMED" ? "확정" : "검토 대기"}
            </span>
            {engine && (
              <span
                className="lbl"
                style={{ padding: "2px 11px", background: "var(--surface-muted)", color: "var(--muted)" }}
              >
                {ENGINE_LABEL[engine] ?? engine}
              </span>
            )}
          </div>

          {loadError && (
            <p className="lmsg err" style={{ maxWidth: maxW, marginTop: 16 }}>
              {loadError}
            </p>
          )}

          {!content ? (
            <div className="placeholder" style={{ maxWidth: maxW, marginTop: 16 }}>
              🤖 AI가 산출물 초안을 만드는 중…
            </div>
          ) : (
            <>
              {artifactState === "DRAFT" && (
                <div className="aidraftnote" style={{ maxWidth: maxW, marginTop: 16 }}>
                  <span>🧩</span>
                  <span>
                    <b>AI 초안입니다.</b> 검토 후 확정해주세요. 아래 필드는 직접 고쳐도 되고, 밑에서 AI에게 다시
                    만들어 달라고 해도 됩니다.
                  </span>
                </div>
              )}

              <div className="wcard" style={{ maxWidth: maxW, marginTop: 16 }}>
                <div className="wcb">
                  {artifactType === "voc" && (
                    <VocBody content={content as VocContent} onChange={patchContent} />
                  )}
                  {artifactType === "functional" && (
                    <FunctionalBody content={content as FunctionalContent} onChange={patchContent} />
                  )}
                  {artifactType === "nonfunctional" && (
                    <FunctionalBody content={content as NonFunctionalContent} onChange={patchContent} nonFunctional />
                  )}
                  {artifactType === "detail-design" && (
                    <DetailDesignBody content={content as DetailDesignContent} onChange={patchContent} />
                  )}
                </div>
              </div>

              <div className="wcard" style={{ maxWidth: maxW, marginTop: 16 }}>
                <div className="wcb">
                  <div className="fieldlab" style={{ marginTop: 0 }}>
                    🤖 AI로 재생성 <span style={{ fontWeight: 400, color: "var(--faint)", fontSize: 11.5 }}>· 참고할 내용을 적고 재생성하세요(선택)</span>
                  </div>
                  <AutoGrowTextarea
                    className="reqta"
                    style={{ minHeight: 48 }}
                    value={regenNote}
                    onChange={setRegenNote}
                    placeholder="예: 예외 시나리오를 좀 더 구체적으로 적어줘."
                  />
                  <div className="wfoot" style={{ paddingTop: 10 }}>
                    <button className="btn sm" onClick={onRegenerate} disabled={regenerating}>
                      {regenerating ? "재생성 중…" : "🤖 재생성"}
                    </button>
                  </div>
                  {regenError && (
                    <p className="lmsg err" style={{ marginTop: 8, marginBottom: 0 }}>
                      {regenError}
                    </p>
                  )}
                </div>
              </div>

              {confirmError && (
                <p className="lmsg err" style={{ maxWidth: maxW, marginTop: 16 }}>
                  {confirmError}
                </p>
              )}
              <div className="jf" style={{ maxWidth: maxW, marginTop: 16, borderBottom: "none", justifyContent: "flex-end" }}>
                <button className="btn prim" onClick={onConfirm} disabled={confirming}>
                  {confirming ? "확정 중…" : "✔ 확정"}
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
