package com.interviewPlatform.dtos.response;

import java.time.LocalDateTime;

public record StudentApplicationResponseDTO(
    Long applicationId,
    Long studentId,
    String studentName,
    String studentEmail,
    Double cgpa,
    String studentClass,
    Long interviewRequestId,
    String departmentName,
    String interviewStatus,
    String applicationStatus,
    LocalDateTime appliedAt,
    // Interview scheduling details (set when admin schedules the interview request)
    LocalDateTime scheduledDate,
    String scheduledVenue,
    String meetingLink,
    String contactPerson,
    String assignedInterviewerName,
    String videoUrl
) {}