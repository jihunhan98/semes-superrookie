package com.semes.reqops.domain.knowledge;

import com.semes.reqops.domain.project.entity.Project;
import com.semes.reqops.domain.project.repository.ProjectRepository;
import com.semes.reqops.domain.requirement.service.ReviewAnalysisStore;
import com.semes.reqops.global.ai.*;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.mockito.Mockito.*;

class RequirementReviewRunnerTest {
    @Test void projectNameAndDescriptionReachDomainTermExtraction() {
        var store=mock(ReviewAnalysisStore.class);var glossary=mock(GlossaryService.class);
        var ai=mock(AiClient.class);var projects=mock(ProjectRepository.class);
        var response=new AiAnalyzeDto.Response(List.of(),"본문","rule","full-context",1);
        when(projects.findById(1L)).thenReturn(Optional.of(new Project("VCS","고객","Vehicle Control System",7L)));
        when(store.existing(1L,2L)).thenReturn(List.of());when(glossary.forAnalysis(1L)).thenReturn(List.of());
        when(glossary.hash(List.of())).thenReturn("hash");
        when(ai.analyzeWithGlossary(eq("본문"),isNull(),isNull(),eq(List.of()),eq(List.of()),any(AiAnalyzeDto.ProjectContext.class))).thenReturn(response);
        new RequirementReviewRunner(store,glossary,ai,projects).run(1L,2L,"본문",null,null,true);
        verify(ai).analyzeWithGlossary("본문",null,null,List.of(),List.of(),new AiAnalyzeDto.ProjectContext("VCS","Vehicle Control System"));
        verify(store).save(2L,"본문",response,List.of(),true,"hash");
    }
}
