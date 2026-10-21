package com.semes.reqops.domain.knowledge;
import org.springframework.data.jpa.repository.JpaRepository;import java.util.*;
public interface ClarificationQuestionRepository extends JpaRepository<ClarificationQuestion,Long>{
 List<ClarificationQuestion> findByRequirementIdOrderByIdAsc(Long requirementId);
}
