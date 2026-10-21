package com.semes.reqops.domain.job.worker;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.domain.artifact.service.ArtifactService;
import com.semes.reqops.domain.job.entity.AiTask;
import com.semes.reqops.domain.job.service.AiJobService;
import com.semes.reqops.domain.requirement.repository.*;
import com.semes.reqops.global.ai.AiClient;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;

class AiJobWorkerTest {
    private static <T> T stub(Class<T> type) {
        return mock(type, withSettings().mockMaker("mock-maker-subclass"));
    }
    @Test void retiredQueuedTaskDoesNotCallAiOrArtifactGeneration() {
        AiJobService jobs = stub(AiJobService.class);
        ArtifactService artifacts = stub(ArtifactService.class);
        AiClient ai = stub(AiClient.class);
        RequirementRepository requirements = stub(RequirementRepository.class);
        RequirementFindingRepository findings = stub(RequirementFindingRepository.class);
        RequirementAiDraftRepository drafts = stub(RequirementAiDraftRepository.class);
        AiTask task = new AiTask(1L, "legacy-task", "IMPACT", "{\"operation\":\"impact\",\"projectId\":1}");
        when(jobs.claim("local-worker")).thenReturn(task);
        new AiJobWorker(stub(com.semes.reqops.domain.requirement.service.ReviewAnalysisStore.class), jobs, artifacts, new ObjectMapper(), ai, requirements, findings, drafts).runOne();
        verify(jobs).succeeded(isNull(), contains("ignored"));
        verify(jobs, never()).failed(any(), any(), any());
        verifyNoInteractions(artifacts, ai, requirements, findings, drafts);
    }
}
