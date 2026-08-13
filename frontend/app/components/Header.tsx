"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "../lib/api";
import { clearCurrentUser, getCurrentUser } from "../lib/session";

export default function Header({
  projectName,
  onToggleSidebar,
}: {
  projectName?: string;
  onToggleSidebar?: () => void;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const initial = user?.name?.[0] ?? "?";
  const homeHref = user ? "/dashboard" : "/login";

  function onLogout() {
    clearCurrentUser();
    router.push("/login");
  }

  return (
    <header className="hdr">
      {onToggleSidebar && (
        <button className="burger" onClick={onToggleSidebar} aria-label="사이드바 열기/닫기">
          ☰
        </button>
      )}
      <Link href={homeHref} className="mk">
        RE
      </Link>
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
      {user && (
        <button className="logout" onClick={onLogout}>
          로그아웃
        </button>
      )}
    </header>
  );
}
