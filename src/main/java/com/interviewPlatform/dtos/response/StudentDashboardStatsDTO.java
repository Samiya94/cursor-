package com.interviewPlatform.dtos.response;

import java.util.List;

public record StudentDashboardStatsDTO(
    long interviewsTaken,
    long pendingCount,
    long confirmedCount,
    Double averageScore,
    Double bestScore,
    String firstName,
    String lastName,
    String email,
    String phone,
    String studentClass,
    String departmentName,
    String instituteName,
    String about,
    List<String> skills,
    Double cgpa,
    List<StudentInterviewItemDTO> interviews,
    String resumeFileName,
    String resumeUrl,
    String projectName,
    String projectBrief,
    String projectGithub
) {
    public record StudentInterviewItemDTO(
        Long applicationId,
        Long interviewRequestId,
        String topic,
        String expertise,
        String dateTime,
        String status,
        String contactPerson,
        String remarks,
        java.time.LocalDateTime scheduledDate,
        String meetingLink,
        String scheduledVenue,
        String assignedInterviewerName
    ) {}
}