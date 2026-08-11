"use client";

import { useEffect, useState } from "react";
import type { User } from "../lib/api";

const NAV_ITEMS = [
  {
    label: "대시보드",
    active: true,
    icon: (
      <path d="M6.906.664a1.749 1.749 0 0 1 2.187 0l5.25 4.2c.415.332.657.835.657 1.367v7.019A1.75 1.75 0 0 1 13.25 15h-3.5a.75.75 0 0 1-.75-.75V9H7v5.25a.75.75 0 0 1-.75.75h-3.5A1.75 1.75 0 0 1 1 13.25V6.23c0-.531.242-1.034.657-1.366z" />
    ),
  },
  {
    label: "요구사항",
    icon: (
      <path d="M2.5 3.5A.75.75 0 0 1 3.25 4h9.5a.75.75 0 0 1 0 1.5h-9.5A.75.75 0 0 1 2.5 4.75Zm0 4A.75.75 0 0 1 3.25 8h9.5a.75.75 0 0 1 0 1.5h-9.5A.75.75 0 0 1 2.5 8.75Zm.75 3.5h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1 0-1.5Z" />
    ),
  },
  {
    label: "산출물",
    icon: (
      <path d="m8.878.392 5.25 3.045c.54.314.872.89.872 1.514v6.098a1.75 1.75 0 0 1-.872 1.514l-5.25 3.045a1.75 1.75 0 0 1-1.756 0l-5.25-3.045A1.75 1.75 0 0 1 1 11.049V4.951c0-.624.332-1.201.872-1.514L7.122.392a1.75 1.75 0 0 1 1.756 0Z" />
    ),
  },
  {
    label: "추적성",
    icon: <path d="M5.5 3.25a2.25 2.25 0 1 1 3 2.122v4.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 5.5 3.25Z" />,
  },
];

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("reqops:user");
    if (raw) setUser(JSON.parse(raw));
  }, []);

  const initial = user?.name?.[0] ?? "?";

  return (
    <div className="appshell">
      <header className="hdr">
        <span className="mk">RE</span>
        <span className="brand">요구사항 엔지니어링</span>
        <span className="sp" />
        <div className="search">🔍 프로젝트 검색</div>
        <div className="ico">🔔</div>
        <div className="av" title={user?.name ?? "로그인 필요"}>
          {initial}
        </div>
      </header>

      <div className="body">
        <aside className="side">
          {NAV_ITEMS.map((item) => (
            <a key={item.label} className={`nav${item.active ? " on" : ""}`} href="#">
              <svg viewBox="0 0 16 16" fill="currentColor">
                {item.icon}
              </svg>
              {item.label}
            </a>
          ))}
          <div className="nl">프로젝트</div>
          <a className="nav" href="#">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="8" r="2" />
              <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm0 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2Z" />
            </svg>
            설정
          </a>
        </aside>

        <main className="main">
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>
            {user ? `${user.name}님, 환영합니다` : "대시보드"}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 20px" }}>
            프로젝트 목록·요구사항·산출물 기능은 준비 중입니다.
          </p>
          <div className="placeholder">여기에 프로젝트 목록이 표시될 예정입니다.</div>
        </main>
      </div>
    </div>
  );
}
