package com.interviewPlatform.dtos.response;

import java.time.LocalDateTime;

public record InterviewEvaluationResponseDTO(
        Long id,
        Long applicationId,
        String interviewerName,
        Integer technicalScore,
        Integer communicationScore,
        Integer domainScore,
        Integer approachScore,
        Integer confidenceScore,
        String overallPerformance,
        String strengths,
        String improvements,
        String remarks,
        Double overallScore,
        LocalDateTime createdAt
) {
}
