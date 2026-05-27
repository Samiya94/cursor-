package com.interviewPlatform.dtos.request;

public record SubmitInterviewerRatingDTO(
        Long applicationId,
        Integer rating,
        String feedback
) {
}
