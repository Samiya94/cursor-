package com.interviewPlatform.dtos.response;

public record StudentRegistrationInfoResponse(
    Long   instituteId,
    String instituteName,
    Long   deptId,
    String departmentName
) {}