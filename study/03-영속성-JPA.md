# 영속성 — JPA/Hibernate가 엔티티를 관리하는 방식

## 영속성 컨텍스트란

`@Transactional` 메서드가 실행되는 동안, Hibernate는 그 안에서 다룬 엔티티 객체들을 **영속성 컨텍스트**라는 관리 영역에 등록해둔다. 영속성 컨텍스트는 크게 두 가지를 갖고 있다고 보면 된다:

- **1차 캐시**: 조회한 엔티티 객체 자체(같은 트랜잭션 안에서 같은 id로 또 조회하면 DB 안 가고 캐시에서 바로 줌)
- **스냅샷**: 엔티티를 처음 영속 상태로 만든 시점의 필드 값 복사본 — 나중에 "얼마나 바뀌었는지" 비교하는 기준

## 엔티티 생명주기 4단계

`User` 엔티티로 예를 들면:

1. **비영속(new/transient)**: `new User("20213456", "한지훈", "VCS", "pw")` — 그냥 자바 객체. 영속성 컨텍스트가 전혀 모름.
2. **영속(managed)**: `userRepository.save(user)`를 호출하는 순간(정확히는 `persist()` 호출 시점) 영속성 컨텍스트가 이 객체를 추적하기 시작함.
3. **준영속(detached)**: 영속 상태였다가 트랜잭션이 끝나서(영속성 컨텍스트가 닫혀서) 더 이상 추적되지 않는 상태. 객체 자체는 메모리에 남아있지만 변경해도 DB에 반영 안 됨.
4. **삭제(removed)**: `remove()` 호출됨 — 트랜잭션 커밋 시 DELETE 예정.

## `save()` = INSERT일 수도, UPDATE일 수도 있다

`AuthService.signup()`:
```java
User user = new User(req.empNo(), req.name(), req.dept(), req.password());
userRepository.save(user);
```

`user`는 `id`가 없는(=비영속) 새 객체다. `JpaRepository.save()`는 내부적으로 대략 이렇게 판단한다:

```java
// SimpleJpaRepository 개념적 동작
if (엔티티의 @Id 필드가 null) {
    entityManager.persist(entity);   // → INSERT
} else {
    return entityManager.merge(entity); // → UPDATE (또는 없으면 INSERT)
}
```

`id`가 없으니 `persist()`가 호출되고, 이건 **엔티티를 영속성 컨텍스트에 등록 + INSERT를 예약**하는 것. 아직 DB에 없던 데이터라 "더티체킹으로 UPDATE"가 아니라 그냥 "새로 넣기"다.

## 더티체킹(Dirty Checking) — `save()` 없이 UPDATE가 나가는 이유

이 프로젝트엔 값을 바꾸는 setter가 있는 엔티티가 있다 — `Project.update()`:

```java
public void update(String name, String customer, String description) {
    this.name = name;
    this.customer = customer;
    this.description = description;
}
```

그리고 `ProjectService.update()`에서 이렇게 쓴다:

```java
@Transactional
public DetailResponse update(Long projectId, UpdateRequest req) {
    Project project = projectRepository.findById(projectId)
            .orElseThrow(() -> new ApiErrors.ProjectNotFound(projectId));
    requireOwner(projectId, req.userId());

    project.update(req.name(), req.customer(), req.description());
    // ← 여기서 project.save()나 projectRepository.save(project)를 호출한 적이 없다!

    return detail(projectId, req.userId());
}
```

`project.update(...)`만 호출했을 뿐인데 실제로 DB의 `projects` 테이블은 갱신된다. 왜 그런가:

1. `findById(projectId)`로 조회한 `project`는 **영속 상태**다 — 이 트랜잭션의 영속성 컨텍스트가 이미 추적 중.
2. `project.update(...)`는 그냥 자바 필드 대입일 뿐, SQL과 무관.
3. `@Transactional` 메서드가 끝나는 시점(정확히는 트랜잭션 커밋 직전 **flush** 시점)에, Hibernate가 영속성 컨텍스트 안의 모든 관리 대상 엔티티에 대해 **"현재 필드 값" vs "조회 당시 스냅샷"**을 비교한다.
4. `name`/`customer`/`description`이 스냅샷과 다르면, Hibernate가 자동으로 `UPDATE projects SET name=?, customer=?, description=? WHERE id=?`를 만들어서 실행한다.

**더티체킹이 작동하려면 반드시:**
- 조회(`findById` 등)로 가져온, **영속 상태인** 엔티티를
- 그 엔티티를 조회한 **같은 트랜잭션이 끝나기 전에** 수정해야 한다.

반대로 `AuthService.signup()`처럼 `new`로 만든(비영속) 객체를 고치는 건 더티체킹과 무관하다 — 애초에 비교할 스냅샷이 없다.

## N+1 문제를 이 프로젝트가 피한 방법

`ProjectService.detail()`을 보면:

```java
List<MemberResponse> members = membershipRepository.findByProjectId(projectId).stream()
        .map(m -> {
            User user = userRepository.findById(m.getUserId()).orElse(null);
            return new MemberResponse(m.getUserId(), user != null ? user.getName() : "(탈퇴)", ...);
        })
        .toList();
```

멤버가 N명이면 `userRepository.findById()`가 N번 호출된다 — 이게 바로 **N+1 문제**(멤버 목록 조회 1번 + 각 멤버의 유저 정보 조회 N번)다. 사실 이 코드는 N+1을 "피한" 게 아니라 **그대로 겪고 있는 예시**다. 지금 규모(멤버 몇 명)에선 성능에 영향이 없어서 넘어갔지만, 실무에서 데이터가 많아지면 이건 명백한 개선 대상이다.

**왜 이렇게 짰나?** 이 프로젝트는 `@ManyToOne`/`@OneToMany` 같은 JPA 연관관계 매핑을 **의도적으로 안 썼다** — `Membership.userId`, `Membership.projectId`는 전부 그냥 `Long` 필드고, `User user = ...`를 참조하는 진짜 객체 그래프가 아니다. 연관관계 매핑을 안 쓴 이유:
- 지연 로딩(`LAZY`)/즉시 로딩(`EAGER`) 설정, 양방향 매핑의 연관관계 주인 개념 등 초기 학습 부담을 줄이기 위해
- 대신 그 대가로 N+1을 스스로 코드에서 다 겪게 됨(위 예시처럼)

**만약 연관관계 매핑을 썼다면** N+1을 해결하는 표준적인 방법은:
- `@ManyToOne(fetch = FetchType.LAZY)`로 지연 로딩 기본값 설정
- 실제로 연관 엔티티가 필요한 조회에서만 `JOIN FETCH`(JPQL) 또는 `@EntityGraph`로 한 번의 쿼리에 필요한 데이터를 다 가져오기

## Spring Data JPA 리포지토리 — 메서드 이름이 곧 쿼리가 되는 원리

`MembershipRepository`:
```java
public interface MembershipRepository extends JpaRepository<Membership, Long> {
    List<Membership> findByUserId(Long userId);
    Optional<Membership> findByUserIdAndProjectId(Long userId, Long projectId);
    boolean existsByUserIdAndProjectId(Long userId, Long projectId);
}
```

스프링 데이터 JPA는 앱이 뜰 때 이 인터페이스를 보고, 메서드 이름을 `findBy`/`existsBy` 같은 접두어 + 필드명 + `And`/`Or` 등의 규칙으로 파싱해서 **자동으로 JPQL을 생성**한다.

- `findByUserId(Long userId)` → `SELECT m FROM Membership m WHERE m.userId = :userId`
- `findByUserIdAndProjectId(Long, Long)` → `... WHERE m.userId = :userId AND m.projectId = :projectId`
- `existsByUserIdAndProjectId(...)` → 위와 같은 조건으로 `SELECT COUNT`류 쿼리를 만들고 0보다 큰지만 `boolean`으로 반환

메서드 본문을 한 줄도 안 짰는데 동작하는 이유가 이것 — **메서드 시그니처 자체가 스펙**이고, 구현은 프록시가 리플렉션 정보를 바탕으로 대신 만들어준다.
