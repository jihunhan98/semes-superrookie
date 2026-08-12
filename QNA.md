# Q&A

코드 관련 질문과 답변을 정리한 파일. 새 질문이 오면 이전 내용을 지우고 덮어쓴다.

---

## 1. `memberships` 테이블은 뭐하는 거임?

유저와 프로젝트를 연결하는 중간 테이블. "이 사람이 이 프로젝트에 어떤 역할로 속해있는지"를 저장한다.

```sql
user_id, project_id, role  -- role = OWNER 또는 MEMBER
```

`(user_id, project_id)`에 UNIQUE 제약이 있어서, 같은 사람이 같은 프로젝트에 중복으로 속할 수 없다. 프로젝트 생성 시 생성자가 자동으로 OWNER row가 생기고, 토큰으로 참여하면 MEMBER row가 생긴다.

## 2. `findByTokenAndRevokedFalse` + `orElseThrow` — null이 발생해야 exception을 던지는 건가?

```java
ProjectToken token = projectTokenRepository.findByTokenAndRevokedFalse(req.token())
        .orElseThrow(ApiErrors.InvalidProjectToken::new);
```

`findByTokenAndRevokedFalse`는 **절대 null을 반환하지 않는다** — 리턴 타입이 `Optional<ProjectToken>`이라, 못 찾으면 `Optional.empty()`를, 찾으면 `Optional.of(token)`을 반환한다. `orElseThrow`는 이 Optional이 **비어있는지(empty)**만 본다 — 비어있으면 괄호 안의 걸로 예외를 만들어 던지고, 값이 있으면 그 값을 그대로 꺼내준다. "exception + null"이 아니라, **"Optional이 비었나 안 비었나" 하나만으로 판단**하는 것.

## 3. `@ResponseStatus`는 응답 코드만 담당하나, 반환값(바디)과 별개인가?

완전히 분리돼 있다.

```java
@PostMapping("/signup")
@ResponseStatus(HttpStatus.CREATED)     // ← 상태 코드만 (201)
public UserResponse signup(...) {
    return authService.signup(request);  // ← 응답 바디는 이 리턴값이 JSON으로 직렬화됨
}
```

- **바디**: 메서드 리턴값을 `@RestController`(=`@ResponseBody`)가 JSON으로 변환한 것
- **상태 코드**: `@ResponseStatus`가 없으면 기본 200, 있으면 그 값

둘은 서로 독립적으로 조합된다.

## 4. Stream — 뭐고 왜 쓰는지 (가독성이라기엔 어려워 보임)

"컬렉션을 다루는 방식"이다. for문으로 짜던 걸 **"뭘 할지"만 선언하는 방식**으로 바꾼 것. `ProjectService.list()` 비교:

```java
// for문 버전
List<SummaryResponse> result = new ArrayList<>();
for (Membership m : membershipRepository.findByUserId(userId)) {
    Project project = projectRepository.findById(m.getProjectId()).orElseThrow(...);
    int memberCount = membershipRepository.findByProjectId(project.getId()).size();
    result.add(new SummaryResponse(project.getId(), project.getName(), ..., memberCount));
}
return result;
```

```java
// 스트림 버전 (실제 코드)
return membershipRepository.findByUserId(userId).stream()
        .map(m -> {
            Project project = projectRepository.findById(m.getProjectId()).orElseThrow(...);
            int memberCount = membershipRepository.findByProjectId(project.getId()).size();
            return new SummaryResponse(project.getId(), project.getName(), ..., memberCount);
        })
        .toList();
```

하는 일은 동일. 차이:
- for문 버전은 **빈 리스트를 미리 만들고, 하나씩 채워넣는 "과정"을 직접 짜야** 함(`new ArrayList<>()`, `.add(...)`)
- 스트림 버전은 "Membership 하나하나를 SummaryResponse로 바꿔라(`map`)" → "그걸 리스트로 모아라(`toList`)"라고 **결과만 선언**

어렵게 느껴지는 건 몰라서가 아니라 정상 — `.map()`, `.filter()`, `.toList()` 같은 메서드 이름과 "체이닝" 문법 자체가 처음엔 낯설다. 익숙해지면 for문보다 짧고, 중간에 상태를 잘못 건드릴 여지가 없어서 버그가 덜 난다.

## 5. `reissueToken`의 람다 — 쓰는 이유를 모르겠음

```java
projectTokenRepository.findByProjectIdAndRevokedFalse(projectId)
        .forEach(t -> {
            t.revoke();
            projectTokenRepository.save(t);
        });
```

`forEach`는 "리스트의 각 원소마다 뭘 할지"를 **함수로** 받아야 동작하는 메서드. `t -> { t.revoke(); projectTokenRepository.save(t); }`가 그 함수 — "토큰 하나(`t`)가 주어지면 폐기하고 저장해라"는 동작을 그 자리에서 이름 없이 정의한 것(람다 = 이름 없는 함수).

람다 없이 옛날 방식(익명 클래스):
```java
projectTokenRepository.findByProjectIdAndRevokedFalse(projectId)
        .forEach(new Consumer<ProjectToken>() {
            @Override
            public void accept(ProjectToken t) {
                t.revoke();
                projectTokenRepository.save(t);
            }
        });
```
람다가 이걸 `t -> { ... }`로 줄여준 것. "함수를 변수/파라미터처럼 다른 함수에 전달한다"는 개념만 잡히면 이해된다.

## 6. `requireOwner`에서 예외 나면 UI에서 따로 잡아주나?

두 단계로 나눠서 봐야 한다.

1. **평소엔 아예 안 뜸**: 프론트가 `isOwner`(로그인한 사람의 role)를 미리 체크해서, Member면 "수정"/"멤버 초대" 버튼 자체를 화면에 안 그림(`settings/page.tsx`의 `{isOwner && (...)}`). 정상적인 사용 흐름에서 Member가 이 요청을 보낼 방법 자체가 UI에 없음.
2. **그래도 뚫고 들어오면**: 백엔드가 진짜 방어선. 403이 나고, 프론트의 `catch (err)`가 `err.message`("프로젝트 소유자만 할 수 있는 작업입니다.")를 화면에 보여줌.

**짚어야 할 점**: `onSave`(기본정보 저장) 실패는 카드 안 작은 문구로만 뜨는데, `onReissue`(토큰 재발급) 실패는 `error` state로 가서 **화면 전체가 에러 페이지로 바뀌어버림**. 다듬어지지 않은 부분 — 아직 수정 안 함.
