package com.interviewPlatform.dtos.response;

public record StudentRegistrationResponse(
    Long   studentId,
    String firstName,
    String lastName,
    String email,
    String department,
    String institute,
    String message
) {}