"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signup } from "../lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [empNo, setEmpNo] = useState("");
  const [name, setName] = useState("");
  const [dept, setDept] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [msg, setMsg] = useState<{ type: "err" | "ok"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (password !== password2) {
      setMsg({ type: "err", text: "비밀번호가 일치하지 않습니다." });
      return;
    }
    setLoading(true);
    try {
      const user = await signup({ empNo, name, dept, password });
      router.push(`/login?signup=success&name=${encodeURIComponent(user.name)}`);
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "가입 실패" });
      setLoading(false);
    }
  }

  return (
    <main className="auth-stage">
      <section className="auth-story"><div className="auth-brand"><span className="auth-mark">RE</span><span>ReqOps Agent</span></div><p className="auth-eyebrow">ONE CONNECTED WORKSPACE</p><h1>함께 검토하고,<br/>명확하게 연결하세요.</h1><p className="auth-lead">요구사항과 개발 이슈, 산출물을 하나의 업무 공간에서 이어갑니다.</p><div className="auth-trust"><span>AI 검토</span><span>변경 영향 알림</span><span>근거 추적</span></div></section>
      <section className="auth-panel"><div className="auth-panel-heading"><p>새로운 업무 공간의 시작</p><h2>계정 만들기</h2><span>프로젝트에서 사용할 정보를 입력해 주세요.</span></div>

        <form className="lcard auth-card" onSubmit={onSubmit}>
          {msg && <p className={`lmsg ${msg.type}`}>{msg.text}</p>}

          <div className="lf">
            <label htmlFor="signup-name">이름</label>
            <input id="signup-name" autoComplete="name" disabled={loading} value={name} onChange={(e) => setName(e.target.value)} placeholder="한지훈" required />
          </div>
          <div className="lf">
            <label htmlFor="signup-empno">사번</label>
            <input id="signup-empno" autoComplete="username" disabled={loading} value={empNo} onChange={(e) => setEmpNo(e.target.value)} placeholder="20213xxx" required />
          </div>
          <div className="lf">
            <label htmlFor="signup-dept">부서</label>
            <input id="signup-dept" autoComplete="organization" disabled={loading} value={dept} onChange={(e) => setDept(e.target.value)} placeholder="VCS 개발파트" />
          </div>
          <div className="lf">
            <label htmlFor="signup-password">비밀번호</label>
            <input
              id="signup-password" autoComplete="new-password" disabled={loading} type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="lf">
            <label htmlFor="signup-password2">비밀번호 확인</label>
            <input
              id="signup-password2" autoComplete="new-password" disabled={loading} type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
            />
          </div>

          <button className="lbtn auth-submit" type="submit" disabled={loading}>
            {loading ? "처리 중…" : "가입하기"}
          </button>
        </form>

        <div className="auth-signup">
          이미 계정이 있으신가요?{" "}
          <Link href="/login">로그인 →</Link>
        </div>
      </section>
    </main>
  );
}
