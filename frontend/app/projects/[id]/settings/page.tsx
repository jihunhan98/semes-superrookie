"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../components/Header";
import ProjectSidebar from "../../../components/ProjectSidebar";
import MembersCard from "../../../components/MembersCard";
import { getProject, updateProject, type ProjectDetail } from "../../../lib/api";
import { getCurrentUser } from "../../../lib/session";

export default function ProjectSettingsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!Number.isFinite(projectId)) return;
    getProject(projectId, user.id)
      .then((d) => {
        setDetail(d);
        setName(d.name);
        setCustomer(d.customer ?? "");
        setDescription(d.description ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "프로젝트를 불러오지 못했습니다."));
  }, [projectId, router]);

  async function onSave() {
    const user = getCurrentUser();
    if (!user) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const updated = await updateProject(projectId, { userId: user.id, name, customer, description });
      setDetail(updated);
      setEditing(false);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
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

  if (!detail) {
    return (
      <div className="appshell">
        <Header />
        <main className="main">
          <div className="placeholder">불러오는 중…</div>
        </main>
      </div>
    );
  }

  const isOwner = detail.role === "OWNER";

  return (
    <div className="appshell">
      <Header projectName={detail.name} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="body">
        {sidebarOpen && <ProjectSidebar projectId={detail.id} projectName={detail.name} active="settings" />}
        <main className="main">
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>프로젝트 설정</h1>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 1000, marginTop: 18 }}>
            <div className="setcard">
              <div className="seth">🗂️ 기본 정보</div>
              <div className="setb">
                <div className="frow">
                  <span className="k">프로젝트명</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} disabled={!editing} />
                </div>
                <div className="frow">
                  <span className="k">고객사</span>
                  <input value={customer} onChange={(e) => setCustomer(e.target.value)} disabled={!editing} />
                </div>
                <div className="frow">
                  <span className="k">설명</span>
                  <input value={description} onChange={(e) => setDescription(e.target.value)} disabled={!editing} />
                </div>
                {isOwner && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                    {editing ? (
                      <button className="btn prim sm" onClick={onSave} disabled={saving}>
                        {saving ? "저장 중…" : "저장"}
                      </button>
                    ) : (
                      <button className="btn sm" onClick={() => setEditing(true)}>
                        수정
                      </button>
                    )}
                    {saveMsg && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{saveMsg}</span>}
                  </div>
                )}
              </div>
            </div>

            <MembersCard projectId={detail.id} isOwner={isOwner} members={detail.members} initialToken={detail.token} />
          </div>
        </main>
      </div>
    </div>
  );
}
