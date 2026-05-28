package com.interviewPlatform.dtos.response;

import java.time.LocalDateTime;

public record AdminVideoRecordDTO(
    Long applicationId,
    String studentName,
    String studentClass,
    String instituteName,
    String departmentName,
    String interviewerName,
    LocalDateTime scheduledDate,
    Double score,
    String videoUrl,
    String status
) {}
