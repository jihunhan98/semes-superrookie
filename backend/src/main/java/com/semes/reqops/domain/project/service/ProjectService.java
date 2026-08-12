package com.semes.reqops.domain.project.service;

import com.semes.reqops.domain.project.dto.ProjectDto.CreateRequest;
import com.semes.reqops.domain.project.dto.ProjectDto.DetailResponse;
import com.semes.reqops.domain.project.dto.ProjectDto.JoinRequest;
import com.semes.reqops.domain.project.dto.ProjectDto.MemberResponse;
import com.semes.reqops.domain.project.dto.ProjectDto.SummaryResponse;
import com.semes.reqops.domain.project.dto.ProjectDto.TokenResponse;
import com.semes.reqops.domain.project.dto.ProjectDto.UpdateRequest;
import com.semes.reqops.domain.project.entity.Membership;
import com.semes.reqops.domain.project.entity.Project;
import com.semes.reqops.domain.project.entity.ProjectToken;
import com.semes.reqops.domain.project.entity.Role;
import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.domain.project.repository.ProjectRepository;
import com.semes.reqops.domain.project.repository.ProjectTokenRepository;
import com.semes.reqops.domain.user.entity.User;
import com.semes.reqops.domain.user.repository.UserRepository;
import com.semes.reqops.global.exception.ApiErrors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final MembershipRepository membershipRepository;
    private final ProjectTokenRepository projectTokenRepository;
    private final UserRepository userRepository;

    private static final SecureRandom RANDOM = new SecureRandom();

    /** 프로젝트 생성 — 생성자는 자동으로 Owner가 되고, 접근 토큰이 함께 발급된다. */
    @Transactional
    public DetailResponse create(CreateRequest req) {
        Project project = new Project(req.name(), req.customer(), req.description(), req.userId());
        projectRepository.save(project);

        membershipRepository.save(new Membership(req.userId(), project.getId(), Role.OWNER));
        projectTokenRepository.save(new ProjectToken(project.getId(), generateToken()));

        return detail(project.getId(), req.userId());
    }

    /** 내가 속한 프로젝트 목록. */
    @Transactional(readOnly = true)
    public List<SummaryResponse> list(Long userId) {
        return membershipRepository.findByUserId(userId).stream()
                .map(m -> {
                    Project project = projectRepository.findById(m.getProjectId())
                            .orElseThrow(() -> new ApiErrors.ProjectNotFound(m.getProjectId()));
                    int memberCount = membershipRepository.findByProjectId(project.getId()).size();
                    return new SummaryResponse(
                            project.getId(), project.getName(), project.getCustomer(),
                            project.getDescription(), m.getRole().name(), memberCount);
                })
                .toList();
    }

    /** 접근 토큰으로 프로젝트에 Member로 합류(이미 멤버면 그대로 반환). */
    @Transactional
    public SummaryResponse join(JoinRequest req) {
        ProjectToken token = projectTokenRepository.findByTokenAndRevokedFalse(req.token())
                .orElseThrow(ApiErrors.InvalidProjectToken::new);
        Long projectId = token.getProjectId();

        if (!membershipRepository.existsByUserIdAndProjectId(req.userId(), projectId)) {
            membershipRepository.save(new Membership(req.userId(), projectId, Role.MEMBER));
        }

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ApiErrors.ProjectNotFound(projectId));
        int memberCount = membershipRepository.findByProjectId(projectId).size();
        return new SummaryResponse(project.getId(), project.getName(), project.getCustomer(),
                project.getDescription(), Role.MEMBER.name(), memberCount);
    }

    /** 프로젝트 상세(설정 화면). 토큰은 Owner에게만 내려준다. */
    @Transactional(readOnly = true)
    public DetailResponse detail(Long projectId, Long userId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ApiErrors.ProjectNotFound(projectId));
        Membership membership = membershipRepository.findByUserIdAndProjectId(userId, projectId)
                .orElseThrow(ApiErrors.NotProjectMember::new);

        List<MemberResponse> members = membershipRepository.findByProjectId(projectId).stream()
                .map(m -> {
                    User user = userRepository.findById(m.getUserId()).orElse(null);
                    return new MemberResponse(
                            m.getUserId(),
                            user != null ? user.getName() : "(탈퇴)",
                            user != null ? user.getEmpNo() : null,
                            user != null ? user.getDept() : null,
                            m.getRole().name());
                })
                .toList();

        String token = null;
        if (membership.getRole() == Role.OWNER) {
            token = projectTokenRepository.findByProjectIdAndRevokedFalse(projectId).stream()
                    .findFirst()
                    .map(ProjectToken::getToken)
                    .orElse(null);
        }

        return new DetailResponse(project.getId(), project.getName(), project.getCustomer(),
                project.getDescription(), membership.getRole().name(), token, members);
    }

    /** 기본 정보 수정 (Owner 전용). */
    @Transactional
    public DetailResponse update(Long projectId, UpdateRequest req) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ApiErrors.ProjectNotFound(projectId));
        requireOwner(projectId, req.userId());

        project.update(req.name(), req.customer(), req.description());

        return detail(projectId, req.userId());
    }

    /** 접근 토큰 재발급 — 기존 토큰은 폐기 (Owner 전용). */
    @Transactional
    public TokenResponse reissueToken(Long projectId, Long userId) {
        requireOwner(projectId, userId);

        projectTokenRepository.findByProjectIdAndRevokedFalse(projectId)
                .forEach(t -> {
                    t.revoke();
                    projectTokenRepository.save(t);
                });

        ProjectToken newToken = new ProjectToken(projectId, generateToken());
        projectTokenRepository.save(newToken);
        return new TokenResponse(newToken.getToken());
    }

    private void requireOwner(Long projectId, Long userId) {
        Membership membership = membershipRepository.findByUserIdAndProjectId(userId, projectId)
                .orElseThrow(ApiErrors.NotProjectMember::new);
        if (membership.getRole() != Role.OWNER) {
            throw new ApiErrors.NotProjectOwner();
        }
    }

    private String generateToken() {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        StringBuilder sb = new StringBuilder("req_prj_");
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
