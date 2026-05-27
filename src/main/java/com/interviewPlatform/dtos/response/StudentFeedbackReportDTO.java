package com.interviewPlatform.dtos.response;

import java.time.LocalDateTime;
import java.util.List;

public record StudentFeedbackReportDTO(
        Long applicationId,
        Long interviewRequestId,
        String departmentName,
        String domainName,           // first expertise entry from InterviewRequest
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