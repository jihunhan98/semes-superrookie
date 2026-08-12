"use client";

import { useEffect, useState } from "react";
import type { User } from "../lib/api";
import { getCurrentUser } from "../lib/session";

export default function Header({
  projectName,
  onToggleSidebar,
}: {
  projectName?: string;
  onToggleSidebar?: () => void;
}) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const initial = user?.name?.[0] ?? "?";

  return (
    <header className="hdr">
      {onToggleSidebar && (
        <button className="burger" onClick={onToggleSidebar} aria-label="사이드바 열기/닫기">
          ☰
        </button>
      )}
      <span className="mk">RE</span>
      <span className="brand">
        요구사항 엔지니어링
        {projectName && (
          <>
            <span className="slash">/</span>
            <span className="proj">{projectName}</span>
          </>
        )}
      </span>
      <span className="sp" />
      <div className="search">🔍 프로젝트 검색</div>
      <div className="ico">🔔</div>
      <div className="av" title={user?.name ?? "로그인 필요"}>
        {initial}
      </div>
    </header>
  );
}
