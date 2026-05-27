package com.interviewPlatform.dtos.request;

public record SubmitInterviewEvaluationDTO(
        Long applicationId,
        Integer technicalScore,
        Integer communicationScore,
        Integer domainScore,
        Integer approachScore,
        Integer confidenceScore,
        String overallPerformance,
        String strengths,
        String improvements,
        String remarks
) {
}
