"use client";

import Link from "next/link";

/**
 * 산출물 4종 링크 — 세로로 나열하던 걸 가로 pill 4개로 압축한 것.
 *
 * <p>이슈 카드 목록(`artifacts/[reqId]`)과 이슈 상세 화면이 똑같은 4종 링크를
 * 반복해서 그리므로 여기 한 곳에 둔다. 색은 산출물 "종류"별로 고정(SWVOC=빨강 …)
 * — 이슈마다 도는 색({@link "../lib/issuePalette"})과는 다른 축이다.
 */
export default function ArtifactPills({ base, large }: { base: string; large?: boolean }) {
  return (
    <div className={`pillrow${large ? " lg" : ""}`}>
      <Link className="pill3 p1" href={`${base}/voc`}>
        🗣 SWVOC
      </Link>
      <Link className="pill3 p2" href={`${base}/functional`}>
        ⚙ 기능
      </Link>
      <Link className="pill3 p3" href={`${base}/nonfunctional`}>
        🛡 비기능
      </Link>
      <Link className="pill3 p4" href={`${base}/detail-design`}>
        📐 Design
      </Link>
    </div>
  );
}
