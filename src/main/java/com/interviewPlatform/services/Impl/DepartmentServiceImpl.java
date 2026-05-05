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
import com.interviewPlatform.services.DepartmentService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DepartmentServiceImpl implements DepartmentService {

    private final DepartmentRepository departmentRepository;
    private final InstituteRepository instituteRepository;
    private final InterviewRequestRepository interviewRequestRepository;

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


}
