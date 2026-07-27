import { ComingSoon } from "../components/ComingSoon";
import { FEATURES } from "../lib/nav";

const F = FEATURES[2]; // DB 변경 관리

export default function DatabasePage() {
  const Icon = F.icon;
  return (
    <ComingSoon
      no={F.no}
      name={F.name}
      desc={F.desc}
      icon={<Icon className="h-7 w-7" />}
      planned={[
        "개인 스키마 ↔ 최종 스키마 변경점 감지 (Oracle 데이터 딕셔너리 diff)",
        "변경 테이블에 알림 배지 · 변경 상세(컬럼/행/속성/테이블명) 보기",
        "클릭 한 번으로 개인 스키마에 반영 (git pull 모델)",
        "추가 계열은 즉시 적용, 삭제·타입 변경은 확인 후 적용",
        "스키마 버전 관리 · 변경 이력 (Liquibase/Flyway 활용)",
      ]}
    />
  );
}
