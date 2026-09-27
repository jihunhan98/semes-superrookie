package com.semes.reqops.domain.requirement.repository;
import com.semes.reqops.domain.requirement.entity.RequirementAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface RequirementAttachmentRepository extends JpaRepository<RequirementAttachment,Long>{List<RequirementAttachment> findByRequirementIdOrderByIdAsc(Long requirementId);}
