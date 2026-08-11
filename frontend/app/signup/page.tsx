"use client";

import { useState } from "react";
import Link from "next/link";
import { signup } from "../lib/api";

export default function SignupPage() {
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
      setMsg({ type: "ok", text: `가입 완료: ${user.name}(${user.empNo}). 로그인해 주세요.` });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "가입 실패" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gh-login">
      <div className="loginbox">
        <div className="lmk">RE</div>
        <h2>회원가입</h2>

        <form className="lcard" onSubmit={onSubmit}>
          {msg && <p className={`lmsg ${msg.type}`}>{msg.text}</p>}

          <div className="lf">
            <label>이름</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="한지훈" required />
          </div>
          <div className="lf">
            <label>사번</label>
            <input value={empNo} onChange={(e) => setEmpNo(e.target.value)} placeholder="20213xxx" required />
          </div>
          <div className="lf">
            <label>부서</label>
            <input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="VCS 개발파트" />
          </div>
          <div className="lf">
            <label>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="lf">
            <label>비밀번호 확인</label>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
            />
          </div>

          <button className="lbtn" type="submit" disabled={loading}>
            {loading ? "처리 중…" : "가입하기"}
          </button>
        </form>

        <div className="lfoot">
          가입 후 로그인하면 프로젝트를 만들거나 토큰으로 참여할 수 있습니다. 이미 계정이 있으신가요?{" "}
          <Link href="/login">로그인 →</Link>
        </div>
      </div>
    </div>
  );
}
