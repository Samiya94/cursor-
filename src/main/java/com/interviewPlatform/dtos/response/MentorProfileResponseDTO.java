package com.interviewPlatform.dtos.response;

public record MentorProfileResponseDTO(
    Long id,
    String firstName,
    String lastName,
    String email,
    String phone,
    String designation,
    Long departmentId,
    String departmentName,
    Long instituteId,
    String instituteName
) {
    

}
