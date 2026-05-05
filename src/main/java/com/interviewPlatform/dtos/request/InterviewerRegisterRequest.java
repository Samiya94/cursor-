package com.interviewPlatform.dtos.request;

import java.util.List;

import org.springframework.web.multipart.MultipartFile;

public record InterviewerRegisterRequest(
    String fullName,
    String email,
    String phone,
    String location,

    String jobTitle,
    String company,
    String experience,

    String domain,
    String qualification,

    String linkedin,

    List<String> skills,

    String interviewExperience,

    String bio,

    String password,
    String confirmPassword,
    MultipartFile profilePhoto
) {

}
