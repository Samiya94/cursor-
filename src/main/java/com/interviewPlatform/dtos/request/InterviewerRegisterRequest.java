package com.interviewPlatform.dtos.request;

import java.util.List;

import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record InterviewerRegisterRequest(
    @NotBlank(message = "Full Name is required")
    String fullName,
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    String email,
    @NotBlank(message = "Phone number is required")
    String phone,
    @NotBlank(message = "Location is required")
    String location,

    @NotBlank(message = "Job Title is required")
    String jobTitle,
    @NotBlank(message = "Company is required")
    String company,
    @NotBlank(message = "Experience is required")
    String experience,

    @NotBlank(message = "Domain is required")
    String domain,
    @NotBlank(message = "Qualification is required")
    String qualification,

    String linkedin,

    List<String> skills,

    String interviewExperience,

    String bio,

    @NotBlank(message = "Password is required")
    @Size(min = 6, message = "Password must be at least 6 characters long")
    String password,
    @NotBlank(message = "Confirm password is required")
    String confirmPassword,
    
    MultipartFile profilePhoto,
    MultipartFile resumeFile
) {

}