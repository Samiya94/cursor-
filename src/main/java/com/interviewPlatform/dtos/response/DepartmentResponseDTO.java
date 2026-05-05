package com.interviewPlatform.dtos.response;

public record DepartmentResponseDTO(
    Long id,
    String name,
    Long instituteId,
    String instituteName
) {

}
