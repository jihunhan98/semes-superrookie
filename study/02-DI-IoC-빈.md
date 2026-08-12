# DI / IoC 컨테이너 — 객체를 누가, 언제 만드는가

## IoC(제어의 역전)가 뭔지, 이 프로젝트로 보기

`ProjectController`는 `ProjectService`가 필요하다. IoC를 안 쓴다면 이렇게 짤 것이다:

```java
public class ProjectController {
    private final ProjectService projectService = new ProjectService(new ProjectRepository(), ...);
}
```

`ProjectController`가 **자기 손으로 직접** `ProjectService`를 만든다. 문제는 `ProjectService`를 테스트용 가짜 객체로 바꾸고 싶거나, `ProjectRepository`의 구현이 바뀌면 `ProjectController` 코드까지 건드려야 한다는 것 — 의존관계를 누가 만드는지 통제권이 각 클래스 자신에게 있어서, 결합도가 높아진다.

실제 코드는 이렇다:

```java
@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {
    private final ProjectService projectService;
    // 생성자는 Lombok이 만들어줌 — new ProjectController(???) 를 누가 호출하는지 여기 코드엔 안 보임
}
```

`ProjectController`는 "나는 `ProjectService`가 필요하다"고 **선언만** 할 뿐, 그걸 누가 만들어서 넣어주는지는 전혀 모른다. 객체를 만들고 연결하는 책임이 `ProjectController` 밖으로, 즉 **스프링 컨테이너**로 넘어갔다 — 이게 "제어의 역전(Inversion of Control)"이다. 그리고 컨테이너가 "필요한 걸 대신 넣어주는" 행위가 **DI(Dependency Injection, 의존성 주입)**.

## 앱이 뜰 때 실제로 일어나는 일

1. `ReqopsApplication.main()` → `SpringApplication.run()` 호출
2. `@SpringBootApplication`의 `@ComponentScan`이 `com.semes.reqops` 패키지 이하를 전부 훑음
3. `@RestController`, `@Service`, `@Configuration` 등이 붙은 클래스를 전부 찾아서 "빈 정의(BeanDefinition)" 목록을 만듦 — 이 시점엔 아직 객체 생성 안 함, 그냥 "이런 게 있다"는 메타정보만 수집
4. `ApplicationContext`(스프링 컨테이너)가 이 목록을 보고 실제로 객체를 생성하기 시작. 이때 **의존관계 그래프를 파악**해서 순서를 정함 — 예를 들어 `ProjectService`를 만들려면 `ProjectRepository`, `MembershipRepository`, `ProjectTokenRepository`, `UserRepository`가 먼저 만들어져 있어야 하므로 그것들부터 생성
5. `ProjectService`의 생성자(Lombok이 만든 것)를 리플렉션으로 호출하면서, 앞서 만들어둔 리포지토리 빈들을 인자로 넣어 `new ProjectService(repo1, repo2, ...)` 실행
6. 이렇게 만들어진 `ProjectService` 객체를 "빈 이름(보통 클래스명 첫 글자 소문자, `projectService`)"으로 컨테이너 내부 맵에 저장
7. `ProjectController`를 만들 차례가 되면, 방금 저장해둔 `projectService` 빈을 꺼내서 생성자에 넣음

이 전체 과정이 앱 실행 시작 시점에 **한 번** 일어나고, 이후 요청이 올 때마다 새로 만드는 게 아니라 **이미 만들어둔 빈을 재사용**한다(기본 스코프가 싱글턴이라서 — 아래 참고).

## 왜 리포지토리 인터페이스는 구현체가 없는데도 주입이 되는가

```java
public interface ProjectRepository extends JpaRepository<Project, Long> {
}
```

이 인터페이스엔 메서드 구현이 하나도 없다. 그런데도 `ProjectService`에 `private final ProjectRepository projectRepository;`로 주입받아서 `.save()`, `.findById()`를 바로 쓸 수 있다.

이건 스프링 데이터 JPA가 앱 시작 시점에 `JpaRepository`를 상속한 인터페이스를 전부 찾아서, **런타임에 동적 프록시(다이나믹 프록시)로 구현체를 자동 생성**해 빈으로 등록해주기 때문이다. `findByUserIdAndProjectId(Long, Long)`처럼 우리가 직접 선언한 메서드도, 메서드 이름을 분석("find By UserId And ProjectId" → `WHERE user_id = ? AND project_id = ?`)해서 자동으로 JPQL을 만들어준다(`MembershipRepository` 참고).

## 싱글턴 스코프

스프링 빈은 기본적으로 **싱글턴**이다 — 컨테이너 안에 `ProjectService` 인스턴스가 딱 하나만 존재하고, 모든 요청이 그 하나의 인스턴스를 공유한다. 그래서:

- `ProjectService`에 요청별로 달라지는 상태를 필드로 들고 있으면 안 된다(동시에 여러 요청이 같은 인스턴스의 필드를 건드리게 됨 → 동시성 버그). 이 프로젝트의 서비스 클래스들이 전부 `private final`로 리포지토리만 들고, 가변 상태 필드가 하나도 없는 건 우연이 아니라 **원칙**이다.
- `ProjectService`가 계속 재사용되니, 매번 `new`할 때 드는 비용(리플렉션, 의존관계 해석)이 앱 시작 시 한 번만 든다.

## 생성자 주입이 필드 주입보다 나은 이유 (다시 정리)

[01-어노테이션.md](01-어노테이션.md)에서 짧게 언급했지만, IoC 관점에서 다시 보면:

- 필드 주입(`@Autowired private XXX xxx;`)은 **컨테이너가 객체를 만든 다음** 리플렉션으로 필드에 값을 강제로 꽂아넣는 방식이라, "이 객체가 완전히 준비된 상태"라는 게 생성자 호출 시점엔 보장이 안 됨(필드가 잠깐 `null`인 상태가 존재할 수 있음).
- 생성자 주입은 **객체가 만들어지는 순간 이미 모든 의존성이 다 채워진 상태**로 생성된다 — "생성됐다 = 쓸 준비가 됐다"가 항상 참이 되어 더 안전하다.
