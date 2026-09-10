"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ArtifactPills from "../../../../components/ArtifactPills";
import Header from "../../../../components/Header";
import ProjectSidebar from "../../../../components/ProjectSidebar";
import { mockIssueFor } from "../../../../lib/artifactsMock";
import {
  getProject,
  getRequirement,
  listDevIssues,
  type DevIssue,
  type ProjectDetail,
  type RequirementDetail,
} from "../../../../lib/api";
import { issueColor } from "../../../../lib/issuePalette";
import { getCurrentUser } from "../../../../lib/session";

/**
 * ai-model/main.py 의 _SPLIT_SYSTEM_PROMPT 를 그대로 옮긴 것 — "어떻게 나누는지"를
 * 화면에서 보여주기 위한 표시용 사본. 백엔드 프롬프트를 바꾸면 여기도 같이 고친다.
 */
const SPLIT_PROMPT = `당신은 반도체 장비 소프트웨어(VCS/AMR) 요구사항을 개발 이슈(Jira 티켓)로
나누는 전문가다. 주어진 확정 요구사항 본문을 실제 구현 단위로 몇 개의 개발 이슈로
나눌지 판단하라.

규칙:
- 이슈 경계는 "서로 다른 기능·모듈로 나눠 개발할 수 있는 지점"을 기준으로 삼는다.
- 요구사항이 이미 하나의 작은 변경이면 이슈 1개로 둔다. 억지로 쪼개지 않는다.
- quote는 반드시 원문에 그대로 등장하는 연속된 구절이어야 한다 — 지어내지 않는다.
- title은 15자 내외로 간결하게.

반드시 아래 JSON 형식으로만 답한다.
{"issues":[{"title":"이슈 제목","quote":"원문 그대로의 해당 구절"}]}`;

/** "이슈, 이렇게 나눴어요" — 실제 프롬프트를 예쁘게 접어서 보여주는 도움말 팝오버. */
function SplitHelp() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <span className="helpwrap" ref={ref}>
      <button
        type="button"
        className="helpbtn"
        onClick={() => setOpen((v) => !v)}
        aria-label="이슈를 어떻게 나눴는지 보기"
      >
        ?
      </button>
      {open && (
        <div className="helpdrop">
          <div className="helphd">🧩 이슈, 이렇게 나눴어요</div>
          <p>
            확정된 요구사항 본문을 사내 LLM에게 보내서 몇 개의 개발 이슈로 나눌지 판단합니다.
            LLM이 꺼져 있거나 응답하지 못하면, 문장 단위로 자동 분할한 결과를 대신 보여줍니다.
          </p>
          <div className="helpsub">AI에게 보낸 프롬프트</div>
          <pre className="promptbox">{SPLIT_PROMPT}</pre>
          <p className="helpfoot">
            "AI에게 물어보기"에 적은 내용은 <code>참고 지시: …</code> 한 줄로 이 프롬프트 뒤에 덧붙습니다.
          </p>
        </div>
      )}
    </span>
  );
}

export default function ArtifactsTreePage() {
  const router = useRouter();
  const params = useParams<{ id: string; reqId: string }>();
  const projectId = Number(params.id);
  const requirementId = Number(params.reqId);

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

  // 산출물 내용 자체는 아직 UI만 있어 목업으로 채운다 — 이슈(key·title·구절)만 실제 값.
  const mockIssues = issues.map((issue) => mockIssueFor(issue));

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
            / {req.reqKey}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{req.reqKey} 산출물 도출</h1>
            <span className="tagv">🏷 v{req.version}</span>
          </div>

          {issues.length === 0 ? (
            <>
              {/* AI 검토 결과(불명확·상충)는 여기서 다시 보여주지 않는다 — 그건 요구사항을
                  확정·수정할 때 쓰는 참고 자료라 "수정하기" 화면에만 둔다. 여기는 산출물
                  도출의 입력이 된 확정본이 무엇인지만 그대로 보여준다. */}
              <div className="wcard readonly" style={{ marginTop: 16, maxWidth: 900 }}>
                <div className="wch">
                  📄 확정본
                  <span className="rt">
                    <span className="tagv">v{req.version}</span>
                  </span>
                </div>
                <div className="wcb">
                  <div className="srctext">{req.content}</div>
                </div>
              </div>

              <div className="wcard" style={{ marginTop: 16, maxWidth: 900, borderColor: "var(--purple)" }}>
                <div className="wcb" style={{ textAlign: "center", padding: "28px 16px" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                    🧩 아직 개발 이슈로 나누지 않았습니다
                  </div>
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
                    AI가 이슈 경계를 제안하면, 삭제·추가·제목/구절 수정으로 다듬은 뒤 확정합니다.
                    확정한 이슈마다 산출물 4종(SWVOC·기능·비기능 요구사항·Detail Design)이 함께 붙습니다.
                  </p>
                  <Link className="btn prim" href={`/projects/${project.id}/artifacts/${requirementId}/split`}>
                    🧩 이슈 나누기 시작
                  </Link>
                </div>
              </div>
            </>
          ) : (
            // 왼쪽 확정본 → 화살표 → 오른쪽에 나눠진 이슈를 세로로 나열. 밑에 죽
            // 이어붙이는 것보다 "이게 이렇게 나뉘었다"가 한눈에 들어오게 하려는 것.
            <div className="splitgrid" style={{ marginTop: 16, maxWidth: 1320 }}>
              <div className="wcard readonly">
                <div className="wch">
                  📄 확정본
                  <span className="rt">
                    <span className="tagv">v{req.version}</span>
                  </span>
                </div>
                <div className="wcb">
                  <div className="srctext">{req.content}</div>
                </div>
              </div>

              <div className="splitarrow" aria-hidden="true">
                ➜
              </div>

              <div>
                <div className="artbanner">
                  <span className="aico">🧩</span>
                  <div className="att">
                    개발 이슈 {issues.length}건으로 나눴습니다. <SplitHelp />
                  </div>
                  <Link
                    className="btn sm"
                    style={{ marginLeft: "auto" }}
                    href={`/projects/${project.id}/artifacts/${requirementId}/split`}
                  >
                    🔍 이슈 나누기 검토
                  </Link>
                </div>

                {/* 이슈 하나 = 카드 하나. 왼쪽 색상바는 "이슈 나누기" 화면에서 이 이슈를
                    표시했던 색을 그대로 이어받는다 — 어느 문장에서 나온 이슈인지 색으로
                    계속 따라갈 수 있게(순서=split 확정 당시 순번, issuePalette 참고). */}
                <div className="igrid">
                  {issues.map((real, i) => {
                    const mock = mockIssues[i];
                    const color = issueColor(i);
                    const base = `/projects/${project.id}/artifacts/${requirementId}/issues/${mock.key}`;
                    return (
                      <div key={mock.key} className="icard3" style={{ "--m": color.m } as CSSProperties}>
                        <div className="ic3top">
                          <div>
                            <div className="ic3key">{mock.key}</div>
                            <Link className="ic3ttl" href={base} style={{ color: "inherit", textDecoration: "none" }}>
                              {mock.title}
                            </Link>
                          </div>
                        </div>
                        {real.quote && <div className="ic3quote">&ldquo;{real.quote}&rdquo;</div>}
                        <ArtifactPills base={base} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
