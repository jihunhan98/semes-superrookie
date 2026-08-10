"use client";

import { useState } from "react";
import Link from "next/link";
import { login } from "../lib/api";

export default function LoginPage() {
  const [empNo, setEmpNo] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ type: "err" | "ok"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const user = await login(empNo, password);
      setMsg({ type: "ok", text: `${user.name}님 환영합니다.` });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "로그인 실패" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center">
      <form className="card" onSubmit={onSubmit}>
        <div className="mk">RE</div>
        <h1 className="title">로그인</h1>

        {msg && <p className={`msg ${msg.type}`}>{msg.text}</p>}

        <div className="field">
          <label>사번</label>
          <input value={empNo} onChange={(e) => setEmpNo(e.target.value)} placeholder="20213456" required />
        </div>
        <div className="field">
          <label>비밀번호</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <button className="primary" type="submit" disabled={loading}>
          {loading ? "확인 중…" : "로그인"}
        </button>

        <p className="foot">
          계정이 없으신가요? <Link href="/signup">회원가입 →</Link>
        </p>
      </form>
    </div>
  );
}
