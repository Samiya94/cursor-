package com.interviewPlatform.dtos.response;

import java.time.LocalDateTime;

public record StudentFeedbackReportDTO(
        Long applicationId,
        Long interviewRequestId,
        String departmentName,
        LocalDateTime scheduledDate,
        String scheduledVenue,
        String interviewerName,
        Long interviewerId,
        String applicationStatus,
        String videoUrl,
        InterviewEvaluationResponseDTO evaluation,
        boolean hasStudentRating,
        Integer studentRating,
        String studentRatingFeedback
) {
}
