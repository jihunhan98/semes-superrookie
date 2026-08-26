"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../../../../../components/Header";
import ProjectSidebar from "../../../../../../../components/ProjectSidebar";
import { findMockIssue, type BehaviorRow, type DevIssue } from "../../../../../../../lib/artifactsMock";
import { getProject, getRequirement, type ProjectDetail, type RequirementDetail } from "../../../../../../../lib/api";
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

function VocBody({ issue }: { issue: DevIssue }) {
  return (
    <>
      <div className="fieldlab">
        설명 <span className="aitag">🤖 AI 도출</span>
      </div>
      <div className="wcard readonly">
        <div className="wcb" style={{ fontSize: 13.5 }}>{issue.voc.description}</div>
      </div>
      <div className="fieldlab">
        1. 요청사항 <span className="aitag">🤖 AI 도출</span>
      </div>
      <div className="wcard readonly">
        <div className="wcb" style={{ fontSize: 13.5 }}>{issue.voc.request}</div>
      </div>
      <div className="fieldlab">
        2. 특이사항 <span className="aitag">🤖 AI 초안</span>{" "}
        <span style={{ fontWeight: 400, color: "var(--faint)", fontSize: 11.5 }}>· 사람 보완 권장</span>
      </div>
      <div className="wcard readonly">
        <div className="wcb" style={{ fontSize: 13.5 }}>{issue.voc.notes}</div>
      </div>
    </>
  );
}

function FunctionalBody({ issue, nonFunctional }: { issue: DevIssue; nonFunctional?: boolean }) {
  const art = nonFunctional ? issue.nonFunctional : issue.functional;
  return (
    <>
      <div className="fieldlab">
        설명 <span className="aitag">🤖 AI 도출</span>
      </div>
      <div className="wcard readonly">
        <div className="wcb" style={{ fontSize: 13.5 }}>{art.description}</div>
      </div>
      <div className="fieldlab">
        1. 개요 <span className="aitag">🤖 AI 도출</span>
      </div>
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
      <div className="fieldlab">
        2. 동작 정의 <span className="aitag">🤖 AI 도출</span>{" "}
        <span style={{ fontWeight: 400, color: "var(--faint)", fontSize: 11.5 }}>
          · 동작 유형(기본·예외) × 항목(선행조건·시나리오·후행조건)
        </span>
      </div>
      <BehaviorTable rows={art.behaviors} />
      {nonFunctional && (
        <>
          <div className="fieldlab">
            제약사항 <span className="aitag">🤖 AI 도출</span>
          </div>
          <div className="wcard readonly">
            <div className="wcb" style={{ fontSize: 13.5 }}>{issue.nonFunctional.constraints}</div>
          </div>
        </>
      )}
    </>
  );
}

function DetailDesignBody({ issue }: { issue: DevIssue }) {
  const dd = issue.detailDesign;
  return (
    <>
      <div className="fieldlab">
        Class Diagram — 영향 범위 <span className="aitag">🤖 AI 도출</span>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--faint)", margin: "0 0 8px" }}>
        AI가 생성한 Mermaid classDiagram 코드를 렌더링한 모습(예시)
      </p>
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

      <div className="fieldlab">
        Sequence Diagram — 변경 전/후 <span className="aitag">🤖 AI 도출</span>
      </div>
      <div className="seqcols">
        <div className="seqcol asis">
          <h5>AS-IS</h5>
          {dd.sequenceBefore.map((s, i) => (
            <div key={i} className="seqstep">
              <span className="n">{i + 1}</span>
              <span>
                <span className="who">{s.who}</span> → {s.msg}
              </span>
            </div>
          ))}
        </div>
        <div className="seqcol tobe">
          <h5>TO-BE</h5>
          {dd.sequenceAfter.map((s, i) => (
            <div key={i} className={`seqstep${s.changed ? " new" : ""}`}>
              <span className="n">{i + 1}</span>
              <span>
                <span className="who">{s.who}</span> → {s.msg}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="fieldlab">
        설명 <span className="aitag">🤖 AI 도출</span>
      </div>
      <div className="wcard readonly">
        <div className="wcb" style={{ fontSize: 13.5 }}>{dd.description}</div>
      </div>
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 14 }}>
        🎨 이미지가 아니라 코드로 받는다 — AI는 위 다이어그램을 <b>Mermaid 문법 텍스트</b>로 생성하고, 화면은 그
        텍스트를 그대로 렌더링한 결과다.
      </p>
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
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!Number.isFinite(projectId) || !Number.isFinite(requirementId)) return;

    Promise.all([getProject(projectId, user.id), getRequirement(projectId, requirementId, user.id)])
      .then(([p, r]) => {
        setProject(p);
        setReq(r);
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

  if (!project || !req) {
    return (
      <div className="appshell">
        <Header />
        <main className="main">
          <div className="placeholder">불러오는 중…</div>
        </main>
      </div>
    );
  }

  const issue = findMockIssue(issueKey);
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

          <div className="wcard" style={{ maxWidth: 900, marginTop: 16 }}>
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
