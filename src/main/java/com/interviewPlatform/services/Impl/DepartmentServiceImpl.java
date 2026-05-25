package com.interviewPlatform.services.Impl;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.interviewPlatform.dtos.request.DepartmentRequestDTO;
import com.interviewPlatform.dtos.response.DepartmentResponseDTO;
import com.interviewPlatform.dtos.response.DepartmentStatsResponseDTO;
import com.interviewPlatform.entities.Department;
import com.interviewPlatform.entities.Institute;
import com.interviewPlatform.entities.InterviewRequest;
import com.interviewPlatform.repositories.DepartmentRepository;
import com.interviewPlatform.repositories.InstituteRepository;
import com.interviewPlatform.repositories.InterviewRequestRepository;
import com.interviewPlatform.repositories.StudentRepository;
import com.interviewPlatform.services.DepartmentService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DepartmentServiceImpl implements DepartmentService {

    private final DepartmentRepository departmentRepository;
    private final InstituteRepository instituteRepository;
    private final InterviewRequestRepository interviewRequestRepository;
    private final StudentRepository studentRepository;

    @Transactional
    @Override
    public DepartmentResponseDTO createDepartment(DepartmentRequestDTO dto) {
        if (dto.instituteId() == null) {
        throw new RuntimeException("Institute ID is required");
    }

       Institute institute = instituteRepository.findById(dto.instituteId())
                .orElseThrow(() -> new RuntimeException("Institute not found"));

        Department dept = new Department();
        dept.setName(dto.name());
        dept.setInstitute(institute);

        Department saved = departmentRepository.save(dept);

        return mapToDTO(saved);
    }

    @Override
    public List<DepartmentResponseDTO> getDepartments(Long instituteId) {
        return departmentRepository.findByInstitute_Id(instituteId)
                .stream()
                .map(this::mapToDTO)
                .toList();
    }

    @Override
    public List<DepartmentStatsResponseDTO> getDepartmentStats(Long instituteId) {
        List<Department> departments = departmentRepository.findByInstitute_Id(instituteId);
        Map<String, Long> requestCountByDepartment = interviewRequestRepository.findByInstituteId(instituteId)
                .stream()
                .map(InterviewRequest::getDepartmentName)
                .filter(name -> name != null && !name.isBlank())
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));

        return departments.stream()
                .map(department -> new DepartmentStatsResponseDTO(
                        department.getName(),
                        requestCountByDepartment.getOrDefault(department.getName(), 0L)
                ))
                .toList();
    }

    @Transactional
    @Override
    public void deleteDepartment(Long id) {
        departmentRepository.deleteById(id);
    }

     //  MAPPER
    private DepartmentResponseDTO mapToDTO(Department dept) {
        return new DepartmentResponseDTO(
                dept.getId(),
                dept.getName(),
                dept.getInstitute().getId(),
                dept.getInstitute().getInstituteName()
        );
    }

    @Override
public org.springframework.http.ResponseEntity<?> getStudentsByDepartment(Long deptId) {
    var students = studentRepository.findByDepartmentId(deptId);
    var result = students.stream().map(s -> {
        java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("firstName", s.getFirstName());
        m.put("lastName", s.getLastName());
        m.put("email", s.getUser() != null ? s.getUser().getEmail() : "");
        m.put("phone", s.getPhone());
        m.put("studentClass", s.getStudentClass());
        m.put("cgpa", s.getCgpa());
        m.put("skills", s.getSkills());
        String resumeFileName = s.getResumeUrl();
        m.put("resumeFileName", resumeFileName);
        m.put("resumeUrl", (resumeFileName != null && !resumeFileName.isBlank())
            ? "/uploads/" + resumeFileName
            : null);
        return m;
    }).toList();
    return org.springframework.http.ResponseEntity.ok(result);
}


}
