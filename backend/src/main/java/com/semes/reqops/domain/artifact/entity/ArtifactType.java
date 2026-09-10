package com.semes.reqops.domain.artifact.entity;

import com.semes.reqops.global.exception.ApiErrors;

import java.util.Arrays;

/** 산출물 4종. slug는 프론트 URL(예: /issues/{key}/detail-design)과 1:1로 맞춘다. */
public enum ArtifactType {
    VOC("voc"),
    FUNCTIONAL("functional"),
    NONFUNCTIONAL("nonfunctional"),
    DETAIL_DESIGN("detail-design");

    private final String slug;

    ArtifactType(String slug) {
        this.slug = slug;
    }

    public String slug() {
        return slug;
    }

    public static ArtifactType fromSlug(String slug) {
        return Arrays.stream(values())
                .filter(t -> t.slug.equals(slug))
                .findFirst()
                .orElseThrow(() -> new ApiErrors.ArtifactTypeNotFound(slug));
    }
}
