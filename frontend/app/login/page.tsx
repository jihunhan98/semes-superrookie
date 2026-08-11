"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [empNo, setEmpNo] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ type: "err" | "ok"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("signup") === "success") {
      const name = params.get("name");
      setMsg({ type: "ok", text: `${name ? `${name}님, ` : ""}가입이 완료되었습니다. 로그인해 주세요.` });
      window.history.replaceState(null, "", "/login");
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const user = await login(empNo, password);
      sessionStorage.setItem("reqops:user", JSON.stringify(user));
      router.push("/dashboard");
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "로그인 실패" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gh-login">
      <div className="loginbox">
        <div className="lmk">RE</div>
        <h2>요구사항 엔지니어링에 로그인</h2>

        <form className="lcard" onSubmit={onSubmit}>
          {msg && <p className={`lmsg ${msg.type}`}>{msg.text}</p>}

          <div className="lf">
            <label>사번</label>
            <input
              value={empNo}
              onChange={(e) => setEmpNo(e.target.value)}
              placeholder="20213xxx"
              required
            />
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

          <button className="lbtn" type="submit" disabled={loading}>
            {loading ? "확인 중…" : "로그인"}
          </button>
        </form>

        <div className="lsignup">
          계정이 없으신가요? <Link href="/signup">회원가입 →</Link>
        </div>
        <div className="lfoot">로그인하면 확정·수정 이력에 작성자로 기록됩니다.</div>
      </div>
    </div>
  );
}
