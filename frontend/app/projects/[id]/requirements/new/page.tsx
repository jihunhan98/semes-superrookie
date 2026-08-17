"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../../components/Header";
import ProjectSidebar from "../../../../components/ProjectSidebar";
import { createRequirement, getProject, type ProjectDetail } from "../../../../lib/api";
import { getCurrentUser } from "../../../../lib/session";

export default function RequirementNewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [reqKey, setReqKey] = useState("");
  const [content, setContent] = useState("");
  const [requesterDept, setRequesterDept] = useState("");
  const [requesterName, setRequesterName] = useState("");

  // 등록은 저장 + AI 초기 검토가 함께 끝나야 완료된다 → 그동안 로딩 표시.
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!Number.isFinite(projectId)) return;
    getProject(projectId, user.id)
      .then((p) => {
        setProject(p);
        // 요청자 기본값은 로그인 사용자 — 대부분 본인이 등록하므로.
        setRequesterDept(user.dept ?? "");
        setRequesterName(user.name);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "프로젝트를 불러오지 못했습니다."));
  }, [projectId, router]);

  async function onSubmit() {
    const user = getCurrentUser();
    if (!user) return;
    if (!reqKey.trim() || !content.trim()) {
      setSaveError("요구사항 ID와 내용은 필수입니다.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const created = await createRequirement(projectId, {
        userId: user.id,
        reqKey: reqKey.trim(),
        content: content.trim(),
        requesterDept: requesterDept.trim(),
        requesterName: requesterName.trim(),
      });
      router.push(`/projects/${projectId}/requirements/${created.id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "등록에 실패했습니다.");
      setSaving(false);
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

  if (!project) {
    return (
      <div className="appshell">
        <Header />
        <main className="main">
          <div className="placeholder">불러오는 중…</div>
        </main>
      </div>
    );
  }

  return (
    <div className="appshell">
      <Header projectName={project.name} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="body">
        {sidebarOpen && (
          <ProjectSidebar projectId={project.id} projectName={project.name} active="requirements" />
        )}
        <main className="main">
          <div className="crumb">
            <b>요구사항</b> / 등록
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 2px" }}>새 요구사항 등록</h1>
          <p className="psub" style={{ marginBottom: 12 }}>
            입력하고 등록하면, 저장과 함께 AI가 자동으로 초기 검토를 시작합니다.
          </p>

          <div className="regcard">
            <div className="rch">📝 요구사항 입력</div>
            <div className="rcb">
              <div className="reqmeta">
                <div className="fi2">
                  <div className="fieldlab">요구사항 ID</div>
                  <input
                    value={reqKey}
                    onChange={(e) => setReqKey(e.target.value)}
                    placeholder="req-am-03"
                    disabled={saving}
                  />
                </div>
                <div className="fi2">
                  <div className="fieldlab">요청자 소속</div>
                  <input
                    value={requesterDept}
                    onChange={(e) => setRequesterDept(e.target.value)}
                    placeholder="삼성전자 EDS · 설비공정그룹"
                    disabled={saving}
                  />
                </div>
                <div className="fi2">
                  <div className="fieldlab">요청자 이름</div>
                  <input
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    placeholder="김민석 책임"
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="fieldlab">요구사항 내용</div>
              <textarea
                className="reqta"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="AMR 매칭 시 가용한 AMR 중 가장 가까운 AMR을 선택한다."
                disabled={saving}
              />
            </div>
          </div>

          {saveError && (
            <p className="lmsg err" style={{ maxWidth: 900 }}>
              {saveError}
            </p>
          )}

          <div className="regfoot">
            <button className="btn prim" onClick={onSubmit} disabled={saving}>
              {saving ? "⏳ 등록 중…" : "등록하기"}
            </button>
            <button
              className="btn"
              onClick={() => router.push(`/projects/${projectId}/requirements`)}
              disabled={saving}
            >
              취소
            </button>
            <span className="note">
              등록하면 상태는 <b>접수</b>가 됩니다.
            </span>
          </div>

          {saving && (
            <div className="loadstate">
              <div className="loadbar">
                <div className="spinner" />
                <div>
                  <div className="load-t">요구사항을 저장하고 AI가 초기 검토를 하고 있습니다…</div>
                  <div className="load-sub">
                    완료되면 접수 상태로 등록되고, 상세 화면에서 바로 AI 참고 의견을 확인할 수 있습니다.
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
