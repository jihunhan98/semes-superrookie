"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import { listProjects, type ProjectSummary } from "../lib/api";
import { getCurrentUser } from "../lib/session";
import { colorFor } from "../lib/colors";

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    listProjects(user.id)
      .then(setProjects)
      .catch((err) => setError(err instanceof Error ? err.message : "프로젝트 목록을 불러오지 못했습니다."));
  }, [router]);

  return (
    <div className="appshell">
      <Header />
      <main className="main" style={{ maxWidth: 1000, margin: "0 auto", width: "100%" }}>
        <div className="toolbar">
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>프로젝트</h1>
          <span style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <Link className="btn prim" href="/projects/new">
              ＋ New Project
            </Link>
          </span>
        </div>
        <p className="psub">
          최근 연 프로젝트에서 이어서 작업하거나(카드 클릭), 새로 만듭니다.
        </p>

        {error && <p className="lmsg err">{error}</p>}

        {!error && projects === null && <div className="placeholder">불러오는 중…</div>}

        {projects !== null && projects.length === 0 && (
          <div className="placeholder">아직 참여 중인 프로젝트가 없습니다. New Project로 시작해보세요.</div>
        )}

        {projects !== null && projects.length > 0 && (
          <div className="pjgrid">
            {projects.map((p) => (
              <Link key={p.id} className="pjc" href={`/projects/${p.id}/settings`}>
                <span className="pic" style={{ background: colorFor(p.name) }}>
                  {p.name.slice(0, 2)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="pnm">{p.name}</span>
                    <span className={`role ${p.role === "OWNER" ? "own" : "mem"}`}>
                      {p.role === "OWNER" ? "Owner" : "Member"}
                    </span>
                  </div>
                  {p.customer && <div className="pcust">{p.customer}</div>}
                  <div className="pmeta">
                    <span>
                      멤버 <b>{p.memberCount}</b>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
            <Link className="pjc new" href="/projects/new">
              ＋ New Project
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
