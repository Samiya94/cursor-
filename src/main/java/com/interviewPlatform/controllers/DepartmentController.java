package com.interviewPlatform.controllers;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.interviewPlatform.dtos.request.DepartmentRequestDTO;
import com.interviewPlatform.dtos.response.DepartmentResponseDTO;
import com.interviewPlatform.dtos.response.DepartmentStatsResponseDTO;
import com.interviewPlatform.services.DepartmentService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/departments")
@RequiredArgsConstructor
@CrossOrigin
public class DepartmentController {

    private final DepartmentService departmentService;

    @PreAuthorize("hasRole('INSTITUTE')")
    @PostMapping
    public DepartmentResponseDTO createDepartment(@RequestBody DepartmentRequestDTO dto) {

        return departmentService.createDepartment(dto);
    }

    @GetMapping("/institute/{instituteId}")
    public List<DepartmentResponseDTO> getDepartments(@PathVariable Long instituteId) {
         return departmentService.getDepartments(instituteId);
    }

    @GetMapping("/stats/{instituteId}")
    public List<DepartmentStatsResponseDTO> getDepartmentStats(@PathVariable Long instituteId) {
        return departmentService.getDepartmentStats(instituteId);
    }

    @PreAuthorize("hasRole('INSTITUTE')")
     @DeleteMapping("/{id}")
    public void deleteDepartment(@PathVariable Long id) {
        departmentService.deleteDepartment(id);
    }

    @GetMapping("/{deptId}/students")
    public ResponseEntity<?> getStudentsByDept(@PathVariable Long deptId) {
        return departmentService.getStudentsByDepartment(deptId);
    }

}
