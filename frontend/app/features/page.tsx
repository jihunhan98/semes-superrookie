import { ComingSoon } from "../components/ComingSoon";
import { FEATURES } from "../lib/nav";

const F = FEATURES[1]; // 기능 요구사항 도출

export default function FeaturesPage() {
  const Icon = F.icon;
  return (
    <ComingSoon
      no={F.no}
      name={F.name}
      desc={F.desc}
      icon={<Icon className="h-7 w-7" />}
      planned={[
        "모호성이 해소된 조항을 개발 단위(FEAT)로 분해 · FEAT-ID 부여",
        "요구사항 ↔ 기능 다대다 연결(link) 유지",
        "기능을 VCS UI · VCS APP(backend) 기능명세로 파생",
        "APP 기능명세: 소속 모듈 · 통신방식(Req-Rep/Pub-Sub) · subject · 입출력 편집",
        "모듈별(8개 모듈) 기능명세 정리 화면",
        "AI 초안 → 담당자가 편집 · 추가 · 삭제",
      ]}
    />
  );
}
