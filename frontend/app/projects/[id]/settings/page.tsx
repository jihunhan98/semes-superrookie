"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../components/Header";
import ProjectSidebar from "../../../components/ProjectSidebar";
import { getProject, updateProject, reissueToken, type ProjectDetail } from "../../../lib/api";
import { getCurrentUser } from "../../../lib/session";
import { colorFor } from "../../../lib/colors";

export default function ProjectSettingsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [customer, setCustomer] = useState("");
  const [description, setDescription] = useState("");
  const [moduleInput, setModuleInput] = useState("");
  const [modules, setModules] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [token, setToken] = useState<string | null>(null);
  const [reissuing, setReissuing] = useState(false);
  const [copied, setCopied] = useState(false);

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
        setModules(d.modules);
        setToken(d.token);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "프로젝트를 불러오지 못했습니다."));
  }, [projectId, router]);

  function addModule() {
    const value = moduleInput.trim();
    if (value && !modules.includes(value)) setModules([...modules, value]);
    setModuleInput("");
  }

  async function onSave() {
    const user = getCurrentUser();
    if (!user) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const updated = await updateProject(projectId, { userId: user.id, name, customer, description, modules });
      setDetail(updated);
      setSaveMsg("저장되었습니다.");
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function onReissue() {
    const user = getCurrentUser();
    if (!user) return;
    if (!window.confirm("토큰을 재발급하면 기존 토큰은 더 이상 쓸 수 없습니다. 계속할까요?")) return;
    setReissuing(true);
    try {
      const res = await reissueToken(projectId, user.id);
      setToken(res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "토큰 재발급에 실패했습니다.");
    } finally {
      setReissuing(false);
    }
  }

  function onCopy() {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
      <Header projectName={detail.name} />
      <div className="body">
        <ProjectSidebar projectName={detail.name} active="settings" />
        <main className="main">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>프로젝트 설정</h1>
            {!isOwner && (
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Member는 조회만 가능합니다</span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 1000, marginTop: 18 }}>
            <div>
              <div className="setcard">
                <div className="seth">
                  🗂️ 기본 정보 <span className="db">DB 저장</span>
                </div>
                <div className="setb">
                  <div className="frow">
                    <span className="k">프로젝트명</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner} />
                  </div>
                  <div className="frow">
                    <span className="k">고객사</span>
                    <input value={customer} onChange={(e) => setCustomer(e.target.value)} disabled={!isOwner} />
                  </div>
                  <div className="frow">
                    <span className="k">설명</span>
                    <input value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isOwner} />
                  </div>
                  {isOwner && (
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                      <button className="btn prim sm" onClick={onSave} disabled={saving}>
                        {saving ? "저장 중…" : "저장"}
                      </button>
                      {saveMsg && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{saveMsg}</span>}
                    </div>
                  )}
                </div>
              </div>

              {isOwner && token && (
                <div className="setcard">
                  <div className="seth">
                    🔑 접근 토큰 <span className="db">DB 저장</span>
                  </div>
                  <div className="setb">
                    <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 9 }}>
                      이 토큰을 팀원에게 주면 Open Project로 참여할 수 있습니다.
                    </div>
                    <div className="tok">
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{token}</span>
                      <button className="copy" onClick={onCopy}>
                        {copied ? "복사됨" : "복사"}
                      </button>
                      <button className="reissue" onClick={onReissue} disabled={reissuing}>
                        {reissuing ? "재발급 중…" : "재발급"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="setcard">
                <div className="seth">
                  👥 멤버 · 권한 <span className="db">DB 저장</span>
                </div>
                <div className="setb">
                  {detail.members.map((m) => (
                    <div key={m.userId} className="memrow">
                      <span className="av2" style={{ background: colorFor(m.name) }}>
                        {m.name[0]}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</span>
                      <span style={{ color: "var(--muted)", fontSize: 12.5 }}>
                        {m.empNo} · {m.dept}
                      </span>
                      <span className={`role ${m.role === "OWNER" ? "own" : "mem"}`} style={{ marginLeft: "auto" }}>
                        {m.role === "OWNER" ? "Owner" : "Member"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="setcard">
                <div className="seth">🧩 대상 모듈 {isOwner && <span className="db">DB 저장</span>}</div>
                <div className="setb">
                  <div className="chips">
                    {modules.map((m) => (
                      <span key={m} className="chip">
                        {m}
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => setModules(modules.filter((x) => x !== m))}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", marginLeft: 4 }}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                    {modules.length === 0 && <span style={{ color: "var(--muted)", fontSize: 13 }}>모듈 없음</span>}
                  </div>
                  {isOwner && (
                    <div className="chip-input">
                      <input
                        value={moduleInput}
                        onChange={(e) => setModuleInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addModule();
                          }
                        }}
                        placeholder="모듈명 입력 후 Enter (저장 버튼으로 반영)"
                      />
                      <button type="button" className="btn sm" onClick={addModule}>
                        추가
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
