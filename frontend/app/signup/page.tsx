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
    <div className="center">
      <form className="card" onSubmit={onSubmit}>
        <div className="mk">RE</div>
        <h1 className="title">회원가입</h1>

        {msg && <p className={`msg ${msg.type}`}>{msg.text}</p>}

        <div className="field">
          <label>이름</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="한지훈" required />
        </div>
        <div className="field">
          <label>사번</label>
          <input value={empNo} onChange={(e) => setEmpNo(e.target.value)} placeholder="20213456" required />
        </div>
        <div className="field">
          <label>부서</label>
          <input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="VCS 개발파트" />
        </div>
        <div className="field">
          <label>비밀번호</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="field">
          <label>비밀번호 확인</label>
          <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required />
        </div>

        <button className="primary" type="submit" disabled={loading}>
          {loading ? "처리 중…" : "가입하기"}
        </button>

        <p className="foot">
          이미 계정이 있으신가요? <Link href="/login">로그인 →</Link>
        </p>
      </form>
    </div>
  );
}
