package com.interviewPlatform.repositories;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.interviewPlatform.entities.Department;

public interface DepartmentRepository extends JpaRepository<Department,Long> {
    List<Department> findByInstitute_Id(Long instituteId);
    Optional<Department> findByNameAndInstituteId(String name, Long instituteId);

    boolean existsByNameAndInstituteId(String name, Long instituteId);

}