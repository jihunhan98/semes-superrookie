# DTO와 record — 왜 DTO는 record이고 엔티티는 클래스인가

## record가 뭘 자동으로 만들어주는가

```java
// ProjectDto.java
public record JoinRequest(
        @NotNull Long userId,
        @NotBlank String token
) {}
```

이 한 줄이 컴파일되면 사실상 이런 클래스와 동급이다:

```java
public final class JoinRequest {
    private final Long userId;
    private final String token;

    public JoinRequest(Long userId, String token) {
        this.userId = userId;
        this.token = token;
    }
    public Long userId() { return userId; }   // getUserId() 아님, userId()
    public String token() { return token; }
    // equals(), hashCode(), toString()도 필드 기준으로 자동 생성
}
```

생성자, 접근자, `equals`/`hashCode`/`toString`을 전부 컴파일러가 만들어준다. 그래서 `AuthService`에서 `req.empNo()`, `req.password()`처럼 `getXxx()`가 아니라 **필드명 그대로 호출**하는 것 — record의 접근자 네이밍 규칙이 그렇다.

## DTO를 record로 만드는 이유

DTO(`SignupRequest`, `LoginRequest`, `CreateRequest`, `DetailResponse` 등)는 전부 "데이터만 나르고 로직은 없는" 객체다. 이런 용도엔 record가 정확히 들어맞는다:

- **불변**: 필드가 전부 `private final` — 한 번 만들어지면 안 바뀜. 요청 데이터를 중간에 누가 변조할 일이 없다는 게 보장됨.
- **보일러플레이트 제거**: 클래스로 직접 짰다면 필드 4개짜리 DTO도 생성자·getter 4개·`equals`/`hashCode`/`toString`까지 20줄은 족히 나옴. record는 한 줄.
- **값 비교가 필드 기준**: `new JoinRequest(1L, "abc").equals(new JoinRequest(1L, "abc"))`가 `true` — 테스트 코드에서 특히 편함.

`ProjectDto.java`를 보면 하나의 클래스(`ProjectDto`) 안에 여러 record를 중첩시켜(`CreateRequest`, `UpdateRequest`, `JoinRequest`, `SummaryResponse`, `MemberResponse`, `DetailResponse`, `TokenResponse`) "이 도메인과 관련된 DTO들"이라는 걸 네임스페이스로 묶어놓은 패턴도 눈여겨볼 만하다:

```java
public final class ProjectDto {
    private ProjectDto() {}  // 인스턴스화 방지 — 순수 네임스페이스 용도
    public record CreateRequest(...) {}
    public record DetailResponse(...) {}
    ...
}
```

## 엔티티는 왜 record가 아니라 클래스인가

`User`, `Project`, `Membership`, `ProjectToken`은 전부 일반 클래스다. JPA 엔티티가 record가 될 수 없는 이유는 record의 특성 자체와 충돌하기 때문이다:

1. **JPA는 파라미터 없는 기본 생성자가 필요하다.** Hibernate가 DB에서 값을 읽어 객체를 만들 때, 일단 빈 객체를 만들고 리플렉션으로 필드를 하나씩 채우는 방식을 쓴다. record는 "모든 필드를 받는 생성자"만 가질 수 있고 파라미터 없는 생성자를 별도로 만들 수 없다(정확히는 만들려면 모든 필드에 기본값을 강제로 넣어야 해서 부자연스럽다). 그래서 엔티티는 `protected User() {}` 같은 빈 생성자를 따로 둔다:
   ```java
   protected User() {}   // JPA 전용, 코드에서 직접 호출 안 함
   public User(String empNo, String name, String dept, String password) { ... }
   ```
2. **JPA는 지연 로딩을 위해 엔티티를 상속해서 프록시 클래스를 만들 수 있어야 한다.** record는 암묵적으로 `final` 클래스라 상속이 불가능하다. (이 프로젝트는 연관관계 매핑을 안 써서 지연 로딩 프록시를 실제로 안 쓰지만, JPA 엔티티라면 언제든 그 가능성이 있어야 하므로 규칙 자체가 record를 막는다.)
3. **엔티티는 원래 가변(mutable)이어야 자연스럽다.** 더티체킹([03-영속성-JPA.md](03-영속성-JPA.md))이 동작하려면 필드 값이 바뀔 수 있어야 하는데, record는 불변이 원칙이라 이 모델과 안 맞는다.

## 정리 — 언제 record, 언제 class

| | record | class |
|---|---|---|
| 이 프로젝트 예시 | `AuthDto`, `ProjectDto` 안의 모든 DTO | `User`, `Project`, `Membership`, `ProjectToken` |
| 목적 | 데이터를 담아 옮기기만 함 | DB 행과 매핑되는, 상태를 가진 객체 |
| 가변성 | 불변 | 가변(필드 변경 → 더티체킹으로 UPDATE) |
| 생성자 | 전체 필드 생성자 하나만 | 기본 생성자(JPA용) + 의미 있는 생성자 |
| 접근자 이름 | `empNo()` | `getEmpNo()` |
