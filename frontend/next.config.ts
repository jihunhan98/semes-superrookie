import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 정적 export: `next build` → out/ 에 순수 HTML/JS 생성.
  // node_modules/npm 없이 python http.server 등으로 바로 서빙 가능.
  // (이 앱은 전부 클라이언트 컴포넌트라 서버 런타임이 필요 없음)
  output: "export",
};

export default nextConfig;
