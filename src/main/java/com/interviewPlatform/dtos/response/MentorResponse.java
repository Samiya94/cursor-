package com.interviewPlatform.dtos.response;

public record MentorResponse(
    Long departmentId,
    String departmentName,
    String coordinatorName,
    String email,
    String phone,
    String designation
) {

}
