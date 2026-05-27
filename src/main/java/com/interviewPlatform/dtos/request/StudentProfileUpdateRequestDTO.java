package com.interviewPlatform.dtos.request;

import java.util.List;

public record StudentProfileUpdateRequestDTO(
        String studentClass,
        Double cgpa,
        String about,
        List<String> skills,
        String projectName,
        String projectBrief,
        String projectGithub
) {
}
