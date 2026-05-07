package com.interviewPlatform.services;

import java.util.List;

import org.springframework.http.ResponseEntity;

import com.interviewPlatform.dtos.request.DepartmentRequestDTO;
import com.interviewPlatform.dtos.response.DepartmentResponseDTO;
import com.interviewPlatform.dtos.response.DepartmentStatsResponseDTO;

public interface DepartmentService {
    DepartmentResponseDTO createDepartment(DepartmentRequestDTO dto);
    List<DepartmentResponseDTO> getDepartments(Long instituteId);
    List<DepartmentStatsResponseDTO> getDepartmentStats(Long instituteId);
    void deleteDepartment(Long id);
    ResponseEntity<?> getStudentsByDepartment(Long deptId);

}
