"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "../lib/api";
import { clearCurrentUser, getCurrentUser } from "../lib/session";
import Icon, { type IconName } from "./ui/Icon";
import styles from "./AppShell.module.css";
const navigation: { key: string; label: string; suffix: string; icon: IconName }[] = [
  { key: "home", label: "프로젝트 홈", suffix: "", icon: "home" },
  { key: "requirements", label: "요구사항", suffix: "/requirements", icon: "list" },
  { key: "artifacts", label: "산출물", suffix: "/artifacts", icon: "box" },
  { key: "settings", label: "설정", suffix: "/settings", icon: "settings" },
];
export default function AppShell({ projectId, projectName, active, children }: {
  projectId: number; projectName?: string; active: string; children: ReactNode;
}) {
  const router = useRouter(), pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null), accountButton = useRef<HTMLButtonElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null), drawer = useRef<HTMLDialogElement>(null);
  useEffect(() => setUser(getCurrentUser()), []);
  useEffect(() => { drawer.current?.close(); setAccountOpen(false); }, [pathname]);
  useEffect(() => {
    function close(e: MouseEvent) { if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false); }
    document.addEventListener("mousedown", close);
    const media = window.matchMedia("(min-width: 768px)");
    const resized = () => { if (media.matches) drawer.current?.close(); };
    media.addEventListener("change", resized);
    return () => { document.removeEventListener("mousedown", close); media.removeEventListener("change", resized); };
  }, []);
  function nav() {
    return <><div className={styles.projectLabel}>WORKSPACE</div><div className={styles.projectName}>{projectName || "프로젝트"}</div><nav aria-label="프로젝트 메뉴">{navigation.map(item => <Link key={item.key} href={`/projects/${projectId}${item.suffix}`} className={`${styles.nav} ${active === item.key ? styles.active : ""}`} aria-current={active === item.key ? "page" : undefined} onClick={() => drawer.current?.close()}><Icon name={item.icon} />{item.label}</Link>)}<span className={`${styles.nav} ${styles.unavailable}`}><Icon name="sort" />추적성<span className={styles.soon}>준비 중</span></span></nav><Link className={styles.allProjects} href="/dashboard"><Icon name="back" />전체 프로젝트</Link></>;
  }
  return <div className={`ui-refresh ${styles.shell}`}>
    <a className={styles.skip} href="#page-content">본문으로 건너뛰기</a>
    <header className={styles.header}>
      <button ref={menuButton} className={`${styles.iconButton} ${styles.mobileMenu}`} aria-label="프로젝트 메뉴 열기" aria-haspopup="dialog" onClick={() => drawer.current?.showModal()}><Icon name="menu" size={19} /></button>
      <Link href="/dashboard" className={styles.brand}><span className={styles.mark}>R</span>ReqOps</Link>
      <span className={styles.slash}>/</span><span className={styles.headerProject}>{projectName || "프로젝트"}</span>
      <div className={styles.account} ref={accountRef} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAccountOpen(false); }} onKeyDown={e => { if (e.key === "Escape") { setAccountOpen(false); accountButton.current?.focus(); } }}>
        <button ref={accountButton} className={styles.avatar} aria-label="계정 정보" aria-expanded={accountOpen} aria-controls="account-panel" onClick={() => setAccountOpen(v => !v)}>{user?.name?.slice(0, 1) || "?"}</button>
        {accountOpen && <div id="account-panel" className={styles.accountPanel}><strong>{user?.name || "사용자"}</strong><span>{user?.dept || "프로젝트 멤버"}</span><button onClick={() => { clearCurrentUser(); router.push("/login"); }}><Icon name="logout" />로그아웃</button></div>}
      </div>
    </header>
    <div className={styles.body}><aside className={styles.sidebar}>{nav()}</aside><main id="page-content" tabIndex={-1} className={styles.main}>{children}</main></div>
    <dialog className={styles.drawer} ref={drawer} aria-labelledby="navigation-title" onClose={() => menuButton.current?.focus()} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) drawer.current?.close(); } }}><div className={styles.drawerTitle}><strong id="navigation-title">프로젝트 메뉴</strong><button className={styles.iconButton} onClick={() => drawer.current?.close()} aria-label="메뉴 닫기"><Icon name="close" /></button></div>{nav()}</dialog>
  </div>;
}
