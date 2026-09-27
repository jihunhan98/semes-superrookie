package com.semes.reqops.domain.issue.entity;

import java.io.Serializable;
import java.util.Objects;

public class IssueLineageId implements Serializable {
    private Long sourceIssueId;
    private Long targetIssueId;
    private String relationType;
    public IssueLineageId() {}
    public IssueLineageId(Long sourceIssueId, Long targetIssueId, String relationType) {
        this.sourceIssueId = sourceIssueId; this.targetIssueId = targetIssueId; this.relationType = relationType;
    }
    @Override public boolean equals(Object value) {
        if (this == value) return true;
        if (!(value instanceof IssueLineageId other)) return false;
        return Objects.equals(sourceIssueId, other.sourceIssueId)
                && Objects.equals(targetIssueId, other.targetIssueId)
                && Objects.equals(relationType, other.relationType);
    }
    @Override public int hashCode() { return Objects.hash(sourceIssueId, targetIssueId, relationType); }
}
