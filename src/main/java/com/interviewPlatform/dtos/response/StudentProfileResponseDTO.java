package com.interviewPlatform.dtos.response;

import java.util.List;

public record StudentProfileResponseDTO(
        Long id,
        String firstName,
        String lastName,
        String email,
        String phone,
        String studentClass,
        Double cgpa,
        String about,
        List<String> skills,
        Long instituteId,
        String instituteName,
        Long departmentId,
        String departmentName,
        String resumeFileName,
        String resumeUrl,
        String projectName,
        String projectBrief,
        String projectGithub,
        Long interviewsTaken
) {
}
