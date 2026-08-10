import Link from "next/link";

export default function Home() {
  return (
    <div className="center">
      <div className="card">
        <div className="mk">RE</div>
        <h1 className="title">요구사항 엔지니어링</h1>
        <Link href="/login">
          <button className="primary" style={{ marginBottom: 10 }}>
            로그인
          </button>
        </Link>
        <Link href="/signup">
          <button className="primary" style={{ background: "#0969da" }}>
            회원가입
          </button>
        </Link>
      </div>
    </div>
  );
}
