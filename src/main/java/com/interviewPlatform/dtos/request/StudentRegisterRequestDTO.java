package com.interviewPlatform.dtos.request;

public record StudentRegisterRequestDTO(
        Long instituteId,
        Long departmentId,
        String token,
        String firstName,
        String lastName,
        String email,
        String phone,
        String studentClass,
        String password,
        String confirmPassword
) {
}
