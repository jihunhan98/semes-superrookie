import type { ReactNode } from "react";

export type FeatureStatus = "done" | "todo";

export type Feature = {
  href: string;
  no: string; // "핵심 기능 1"
  name: string;
  desc: string;
  status: FeatureStatus;
  icon: (props: { className?: string }) => ReactNode;
};

// ── 아이콘 (외부 라이브러리 없이 인라인 SVG) ──────────────────────────
function IconAmbiguity({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 2.5" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function IconFeatures({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M6 8.5v3a3 3 0 0 0 3 3h6" />
      <path d="M18 8.5v7" />
    </svg>
  );
}

function IconDatabase({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </svg>
  );
}

export const FEATURES: Feature[] = [
  {
    href: "/ambiguity",
    no: "핵심 기능 1",
    name: "모호성 해결",
    desc: "요구사항의 모호한 표현을 검출하고, 해석을 확정해 부서 간 해석 차이를 없앤다.",
    status: "done",
    icon: IconAmbiguity,
  },
  {
    href: "/features",
    no: "핵심 기능 2",
    name: "기능 요구사항 도출",
    desc: "모호성이 해소된 조항을 개발 단위(기능)로 분해하고 UI·APP 기능명세로 파생한다.",
    status: "todo",
    icon: IconFeatures,
  },
  {
    href: "/database",
    no: "핵심 기능 3",
    name: "DB 변경 관리",
    desc: "최종 스키마 변경을 감지해 개인 스키마에 클릭 한 번으로 반영한다 (git pull 모델).",
    status: "todo",
    icon: IconDatabase,
  },
];
