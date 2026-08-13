"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { joinProject } from "../../lib/api";
import { getCurrentUser } from "../../lib/session";

export default function OpenProjectPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getCurrentUser()) router.replace("/login");
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    try {
      const project = await joinProject(user.id, token.trim());
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "참여에 실패했습니다.");
      setLoading(false);
    }
  }

  return (
    <div className="gh-login">
      <div className="loginbox" style={{ width: 430 }}>
        <div className="lmk" style={{ background: "linear-gradient(135deg,#1f883d,#0969da)" }}>
          📂
        </div>
        <h2>프로젝트 열기</h2>

        <form className="lcard" onSubmit={onSubmit}>
          {error && <p className="lmsg err">{error}</p>}

          <div className="lf">
            <label>프로젝트 접근 토큰</label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="req_prj_9f3a2c··········"
              required
              style={{ fontFamily: "ui-monospace, SF Mono, JetBrains Mono, Menlo, monospace" }}
            />
          </div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "-4px 0 14px" }}>
            프로젝트 소유자에게 받은 토큰을 넣으면 그 프로젝트에 멤버로 참여합니다.
          </p>

          <button className="lbtn" type="submit" disabled={loading}>
            {loading ? "확인 중…" : "열기"}
          </button>
        </form>

        <div className="lsignup">
          새로 시작하려면 <Link href="/projects/new">New Project →</Link>
        </div>
        <div className="lfoot">잘못되었거나 폐기된 토큰이면 참여가 거부됩니다.</div>
      </div>
    </div>
  );
}
