package com.interviewPlatform.dtos.response;

import java.time.LocalDateTime;

public record StudentResumeResponseDTO(
    Long studentId,
    String resumeFileName,
    LocalDateTime uploadedAt,
    String resumeUrl
) {}

