"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "../lib/api";
import { setCurrentUser } from "../lib/session";

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
      setCurrentUser(user);
      router.push("/dashboard");
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "로그인 실패" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-stage">
      <section className="auth-story" aria-labelledby="auth-product-title">
        <div className="auth-brand">
          <span className="auth-mark">RE</span>
          <span>ReqOps Agent</span>
        </div>
        <p className="auth-eyebrow">REQUIREMENT OPERATIONS</p>
        <h1 id="auth-product-title">
          요구사항에서 개발 산출물까지,
          <br />한 흐름으로 연결합니다.
        </h1>
        <p className="auth-lead">
          원문과 고객 합의를 보존하고, AI 제안을 검토한 뒤 추적 가능한 버전으로 확정하세요.
        </p>

        <ol className="auth-flow" aria-label="ReqOps 업무 흐름">
          <li><span>01</span><strong>등록</strong><small>원문·요청자 보존</small></li>
          <li><span>02</span><strong>검출·합의</strong><small>질문과 근거 확인</small></li>
          <li><span>03</span><strong>도출</strong><small>이슈·4종 산출물 생성</small></li>
          <li><span>04</span><strong>검토·확정</strong><small>버전과 이력 고정</small></li>
        </ol>

        <div className="auth-trust" aria-label="제품 특성">
          <span>원문 보존</span>
          <span>합의 기반 확정</span>
          <span>변경 이력 추적</span>
        </div>
      </section>

      <section className="auth-panel" aria-label="로그인">
        <div className="auth-mobile-brand"><span>RE</span> ReqOps Agent</div>
        <div className="auth-panel-heading">
          <p>다시 오신 것을 환영합니다</p>
          <h2>업무 공간에 로그인</h2>
          <span>사번으로 프로젝트와 담당 요구사항을 이어서 확인합니다.</span>
        </div>

        <form className="lcard auth-card" onSubmit={onSubmit}>
          {msg && <p className={`lmsg ${msg.type}`}>{msg.text}</p>}

          <div className="lf">
            <label htmlFor="login-emp-no">사번</label>
            <input
              id="login-emp-no"
              value={empNo}
              onChange={(e) => setEmpNo(e.target.value)}
              placeholder="사번을 입력하세요"
              autoComplete="username"
              required
            />
          </div>
          <div className="lf">
            <label htmlFor="login-password">비밀번호</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              autoComplete="current-password"
              required
            />
          </div>

          <button className="lbtn auth-submit" type="submit" disabled={loading}>
            {loading ? "확인 중…" : "로그인"}
          </button>
        </form>

        <div className="auth-signup">
          <span>처음 사용하시나요?</span>
          <Link href="/signup">새 계정 만들기</Link>
        </div>
        <p className="auth-audit-note">
          로그인 정보는 확정·수정 이력의 작성자 식별에 사용됩니다.
        </p>
      </section>
    </main>
  );
}
