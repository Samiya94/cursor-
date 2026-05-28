package com.interviewPlatform.dtos.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record MentorRegisterRequest(
    @NotNull(message = "Institute ID is required")
    Long instituteId,
    @NotBlank(message = "Registration token is required")
    String token,

    @NotBlank(message = "First name is required")
    String firstName,
    @NotBlank(message = "Last name is required")
    String lastName,
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    String email,
    @NotBlank(message = "Phone number is required")
    String phone,

    @NotNull(message = "Department ID is required")
    Long departmentId,
    @NotBlank(message = "Designation is required")
    String designation,

    @NotBlank(message = "Password is required")
    @Size(min = 6, message = "Password must be at least 6 characters long")
    String password,
    @NotBlank(message = "Confirm password is required")
    String confirmPassword
) {

}
