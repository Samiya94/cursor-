package com.interviewPlatform.dtos.request;

import java.time.LocalDateTime;
import java.util.List;

public record InterviewRequestDTO(
    String departmentName,
    List<String> expertise,

    LocalDateTime startDate,
    LocalDateTime endDate,

    String contactPerson,
    String contactEmail,
    String remarks
) {

}
