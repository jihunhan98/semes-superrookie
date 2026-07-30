# Git 관리 전략 (Solo / SuperRookie)

혼자 개발하는 모노레포(프론트엔드 + 백엔드 + AI 모델/Hugging Face) 프로젝트를 위한 형상 관리 전략입니다.
협업용 규칙(PR 리뷰, 코드오너 등)은 배제하고, **혼자서도 히스토리를 깔끔하게 추적하고 필요하면 롤백/비교하기 쉬운 것**을 목표로 합니다.

## 1. 브랜치 전략: 트렁크 기반 (Trunk-Based, 경량)

- `main`: 항상 정상 동작하는 상태 유지. 실험 중인 코드나 깨진 상태를 두지 않음.
- 작업 단위별로 짧은 수명의 브랜치를 파서 작업 후 `main`에 합치고 바로 삭제.
- 브랜치 이름 규칙 (영역 접두사 포함):
  - `feat/frontend-로그인폼`
  - `feat/backend-user-api`
  - `exp/ai-classification-finetune` (AI 모델 실험용은 `exp/`)
  - `fix/backend-null-check`
  - `chore/deps-update`
- 오래 끄는 브랜치는 지양. 하루~며칠 내에 머지하는 걸 목표로 작게 쪼개서 작업.

## 2. 커밋 컨벤션: Conventional Commits + 영역(scope) 표기

모노레포이므로 커밋 메시지에 어느 영역인지 scope로 명시합니다.

```
<type>(<scope>): <설명>

예)
feat(frontend): 로그인 폼 UI 추가
fix(backend): 유저 조회 API null 처리
chore(ai): huggingface 모델 버전 고정
docs: README 업데이트
refactor(frontend): 상태관리 hook 분리
```

**type 종류**: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf`, `exp`(모델 실험)
**scope 종류**: `frontend`, `backend`, `ai`, 또는 여러 영역이면 생략

커밋은 작더라도 자주, 의미 단위로 쪼개서 남기기 (나중에 `git log`/`git bisect`로 추적하기 쉬움).

## 3. 병합 방식

- 혼자 작업이므로 별도 리뷰 없이 로컬에서 바로 머지 가능.
- 히스토리를 남기고 싶으면 `git merge --no-ff feat/xxx` (병합 지점이 로그에 남음).
- 단순 작업은 fast-forward merge도 무방.
- 필요하면 기록/회고용으로 `gh pr create` → 셀프 머지도 가능 (변경 이력을 PR 단위로 보고 싶을 때).

## 4. 모노레포 디렉토리 구조 (권장)

```
/frontend      # 프론트엔드 앱
/backend       # 백엔드 서버/API
/ai-model      # Hugging Face 기반 모델, 학습/추론 스크립트, 노트북
/GIT_STRATEGY.md
/.gitignore
```

각 영역이 독립적으로 빌드/배포된다면 영역별 커밋과 태그를 분리해서 관리 (아래 5번 참고).

## 5. 태깅 / 릴리스 관리

- 전체 프로젝트 마일스톤: `v0.1.0`, `v0.2.0` ...
- 영역별로 배포 시점이 다르면 접두사로 구분: `frontend-v1.0.0`, `backend-v1.0.0`
- 태그는 "이 시점 상태로 배포/제출했다"는 체크포인트 용도로 사용.

## 6. AI 모델(Hugging Face) 관련 주의사항

- 모델 가중치(.bin, .safetensors, .pt 등)와 대용량 캐시는 **git으로 버전 관리하지 않음** (`.gitignore` 처리됨).
- 재현 가능성은 코드(학습 스크립트, config, requirements)로 확보하고, 모델 가중치는 Hugging Face Hub에 올리거나 별도 저장소(S3 등)에 보관.
- 실험 결과/하이퍼파라미터는 커밋 메시지나 `ai-model/experiments/` 같은 로그 파일로 남기는 것을 권장 (모델 버전과 코드 커밋을 매칭할 수 있게).

## 7. 백업 습관

- 혼자 하는 프로젝트일수록 로컬에만 있는 작업물이 사라지기 쉬움 → 하루 작업 마무리 시 최소 1번은 `origin`에 push.
- 실험적이거나 깨질 수 있는 작업은 `exp/`, `wip/` 브랜치에서 하고, 안정화되면 `main`에 합치기.

## 8. 하지 않는 것 (Overkill 방지)

- 팀 협업용 브랜치 보호 규칙, 필수 리뷰어, CODEOWNERS 등은 설정하지 않음.
- 매 커밋마다 PR을 만들 필요 없음 (원할 때만 기록용으로 사용).
- 과도한 브랜치 세분화 지양 — 작업 단위가 작으면 `main`에 바로 커밋해도 무방.
