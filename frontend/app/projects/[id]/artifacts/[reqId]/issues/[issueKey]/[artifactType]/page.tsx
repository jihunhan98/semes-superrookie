"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../../../../../components/Header";
import MermaidDiagram from "../../../../../../../components/MermaidDiagram";
import ProjectSidebar from "../../../../../../../components/ProjectSidebar";
import {
  mockIssueFor,
  toMermaidSequence,
  type BehaviorRow,
  type MockIssue,
} from "../../../../../../../lib/artifactsMock";
import {
  getProject,
  getRequirement,
  listDevIssues,
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

function BehaviorTable({ rows }: { rows: BehaviorRow[] }) {
  const base = rows.filter((r) => r.type === "기본");
  const exc = rows.filter((r) => r.type === "예외");
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
          <tr key={`base-${i}`}>
            {i === 0 && (
              <td rowSpan={base.length} className="grp base">
                기본
                <span className="sub">정상 흐름</span>
              </td>
            )}
            <td>{r.item}</td>
            <td>{r.content}</td>
          </tr>
        ))}
        {exc.map((r, i) => (
          <tr key={`exc-${i}`}>
            {i === 0 && (
              <td rowSpan={exc.length} className="grp exc">
                예외
                <span className="sub">오류·실패</span>
              </td>
            )}
            <td>{r.item}</td>
            <td>{r.content}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function VocBody({ issue }: { issue: MockIssue }) {
  return (
    <>
      <div className="fieldlab">설명</div>
      <textarea className="reqta" style={{ minHeight: 56 }} defaultValue={issue.voc.description} />
      <div className="fieldlab">1. 요청사항</div>
      <textarea className="reqta" style={{ minHeight: 56 }} defaultValue={issue.voc.request} />
      <div className="fieldlab">2. 특이사항</div>
      <textarea className="reqta" style={{ minHeight: 56 }} defaultValue={issue.voc.notes} />
    </>
  );
}

function FunctionalBody({ issue, nonFunctional }: { issue: MockIssue; nonFunctional?: boolean }) {
  const art = nonFunctional ? issue.nonFunctional : issue.functional;
  return (
    <>
      <div className="fieldlab">설명</div>
      <textarea className="reqta" style={{ minHeight: 56 }} defaultValue={art.description} />
      <div className="fieldlab">1. 개요</div>
      <div className="ovbox">
        <div className="r">
          <span className="k">역할</span>
          <span>{art.role}</span>
        </div>
        <div className="r">
          <span className="k">목적</span>
          <span>{art.purpose}</span>
        </div>
      </div>
      <div className="fieldlab">2. 동작 정의</div>
      <BehaviorTable rows={art.behaviors} />
      {nonFunctional && (
        <>
          <div className="fieldlab">제약사항</div>
          <textarea className="reqta" style={{ minHeight: 56 }} defaultValue={issue.nonFunctional.constraints} />
        </>
      )}
    </>
  );
}

function SeqBlock({ label, steps }: { label: string; steps: MockIssue["detailDesign"]["sequenceBefore"] }) {
  const code = toMermaidSequence(steps);
  return (
    <div className="seqblock">
      <div className="seqblockhd">
        {label}
        <button type="button" className="btn sm" style={{ marginLeft: "auto" }}>
          복사
        </button>
      </div>
      <pre className="promptbox" style={{ margin: "0 0 10px" }}>{code}</pre>
      <MermaidDiagram code={code} />
    </div>
  );
}

function DetailDesignBody({ issue }: { issue: MockIssue }) {
  const dd = issue.detailDesign;
  return (
    <>
      <div className="fieldlab">Class Diagram — 영향 범위</div>
      <div className="clsrow">
        {dd.classDiagram.map((c, i) => (
          <>
            {i > 0 && <span key={`arrow-${i}`} className="clsarrow">uses →</span>}
            <div key={c.name} className="clsbox">
              <div className={`cname${c.changed ? " chg" : ""}`}>
                {c.name}
                {c.changed ? " (변경)" : ""}
              </div>
              {c.fields.map((f) => (
                <div key={f} className="cfield">
                  {f}
                </div>
              ))}
            </div>
          </>
        ))}
      </div>

      <div className="fieldlab">Sequence Diagram — 변경 전/후</div>
      <div className="seqcols2">
        <SeqBlock label="AS-IS" steps={dd.sequenceBefore} />
        <SeqBlock label="TO-BE" steps={dd.sequenceAfter} />
      </div>

      <div className="fieldlab">설명</div>
      <textarea className="reqta" style={{ minHeight: 56 }} defaultValue={dd.description} />
    </>
  );
}

export default function ArtifactDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string; reqId: string; issueKey: string; artifactType: string }>();
  const projectId = Number(params.id);
  const requirementId = Number(params.reqId);
  const issueKey = params.issueKey;
  const artifactType = params.artifactType;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [req, setReq] = useState<RequirementDetail | null>(null);
  const [issues, setIssues] = useState<DevIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
  const issue = realIdx < 0 ? null : mockIssueFor(issues[realIdx], realIdx + 1);
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

  const state =
    artifactType === "voc"
      ? issue.voc.state
      : artifactType === "functional"
        ? issue.functional.state
        : artifactType === "nonfunctional"
          ? issue.nonFunctional.state
          : issue.detailDesign.state;

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
                background: state === "확정" ? "var(--green-soft)" : "var(--surface-muted)",
                color: state === "확정" ? "var(--green)" : "var(--muted)",
              }}
            >
              {state}
            </span>
          </div>
          <div className="jf" style={{ maxWidth: 900, marginTop: 8, borderBottom: "none", gap: 10 }}>
            <button className="btn sm">🤖 재생성</button>
            <button className="btn sm">✔ 확정</button>
          </div>

          <div className="aidraftnote" style={{ maxWidth: 900, marginTop: 16 }}>
            <span>🧩</span>
            <span>
              <b>AI 초안입니다.</b> 검토 후 확정해주세요.
            </span>
          </div>

          <div className="wcard" style={{ maxWidth: 900 }}>
            <div className="wcb">
              {artifactType === "voc" && <VocBody issue={issue} />}
              {artifactType === "functional" && <FunctionalBody issue={issue} />}
              {artifactType === "nonfunctional" && <FunctionalBody issue={issue} nonFunctional />}
              {artifactType === "detail-design" && <DetailDesignBody issue={issue} />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
