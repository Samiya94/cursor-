package com.interviewPlatform.dtos.response;

import java.time.LocalDateTime;
import java.util.List;

public record InterviewRequestResponseDTO(
    Long id,
    String departmentName,
    List<String> expertise,
    LocalDateTime startDate,
    LocalDateTime endDate,
    String contactPerson,
    String contactEmail,
    String remarks,
    String status,
    LocalDateTime createdAt,
    // Scheduling fields (filled once admin schedules)
    LocalDateTime scheduledDate,
    String scheduledVenue,
    String meetingLink,
    Integer numberOfStudentsRequired,
    Integer registeredStudentsCount,
    Boolean instituteConfirmed,
    java.util.List<Long> assignedInterviewerIds,
    java.util.List<String> assignedInterviewerNames,
    // Institute info (useful for admin view)
    Long instituteId,
    String instituteName,
    // Assigned interviewer info
    Long assignedInterviewerId,
    String assignedInterviewerName
) {}