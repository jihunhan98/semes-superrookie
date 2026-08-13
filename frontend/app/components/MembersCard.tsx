"use client";

import { useState } from "react";
import { reissueToken, type ProjectMember } from "../lib/api";
import { colorFor } from "../lib/colors";
import { getCurrentUser } from "../lib/session";

export default function MembersCard({
  projectId,
  isOwner,
  members,
  initialToken,
}: {
  projectId: number;
  isOwner: boolean;
  members: ProjectMember[];
  initialToken: string | null;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [token, setToken] = useState(initialToken);
  const [reissuing, setReissuing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onReissue() {
    const user = getCurrentUser();
    if (!user) return;
    if (!window.confirm("토큰을 재발급하면 기존 토큰은 더 이상 쓸 수 없습니다. 계속할까요?")) return;
    setReissuing(true);
    setError(null);
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

  return (
    <div className="setcard">
      <div className="seth">👥 멤버 · 권한</div>
      <div className="setb">
        {members.map((m) => (
          <div key={m.userId} className="memrow">
            <span className="av2" style={{ background: colorFor(m.name) }}>
              {m.name[0]}
            </span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</span>
            <span style={{ color: "var(--muted)", fontSize: 12.5 }}>{m.dept}</span>
            <span className={`role ${m.role === "OWNER" ? "own" : "mem"}`} style={{ marginLeft: "auto" }}>
              {m.role === "OWNER" ? "Owner" : "Member"}
            </span>
          </div>
        ))}

        {isOwner && (
          <div style={{ marginTop: 11 }}>
            {error && <p className="lmsg err">{error}</p>}
            {!inviteOpen ? (
              <button className="btn sm" onClick={() => setInviteOpen(true)}>
                ＋ 멤버 초대 (토큰 발급)
              </button>
            ) : (
              <>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
