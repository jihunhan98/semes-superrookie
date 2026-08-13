"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createProject } from "../../lib/api";
import { getCurrentUser } from "../../lib/session";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getCurrentUser()) router.replace("/login");
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    try {
      const project = await createProject({ userId: user.id, name, customer, description });
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "프로젝트 생성에 실패했습니다.");
      setLoading(false);
    }
  }

  return (
    <div className="gh-login">
      <div className="loginbox" style={{ width: 430 }}>
        <div className="lmk">＋</div>
        <h2>New Project</h2>

        <form className="lcard" onSubmit={onSubmit}>
          {error && <p className="lmsg err">{error}</p>}

          <div className="lf">
            <label>프로젝트명</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="VCS · 태스크 할당" required />
          </div>
          <div className="lf">
            <label>고객사</label>
            <input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="삼성전자 EDS · 설비공정그룹"
            />
          </div>
          <div className="lf">
            <label>설명</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="newAMOS로부터 Task를 받아 AMR에 할당하는 영역"
            />
          </div>

          <button className="lbtn" type="submit" disabled={loading}>
            {loading ? "생성 중…" : "프로젝트 생성"}
          </button>
        </form>

        <div className="lfoot">
          기존 프로젝트에 참여하시려면 <Link href="/projects/open">Open Project →</Link>
        </div>
      </div>
    </div>
  );
}
