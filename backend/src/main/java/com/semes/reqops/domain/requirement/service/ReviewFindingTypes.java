package com.semes.reqops.domain.requirement.service;

/** Current categories and read-time compatibility for historical review records. */
public final class ReviewFindingTypes {
    public static final String CRITERIA = "수치·판단 기준 불명확";
    public static final String ACTOR = "수행 주체 불명확";
    public static final String CONDITION = "동작 조건 불명확";
    public static final String EXCEPTION = "예외 처리 누락";
    public static final String CONFLICT = "기존 요구사항과 상충";
    private ReviewFindingTypes() {}
    public static String normalize(String value) {
        if (value == null) return null;
        return switch (value) {
            case CRITERIA, "정량 기준 부재", "모호한 정도부사", "시간·일정 모호" -> CRITERIA;
            case ACTOR, "주어·주체 불명확" -> ACTOR;
            case CONDITION, "조건 발생 시점 불명확", "접속사 범위 모호" -> CONDITION;
            case EXCEPTION, "예외·경계 조건 누락" -> EXCEPTION;
            case CONFLICT -> CONFLICT;
            default -> null;
        };
    }
}
