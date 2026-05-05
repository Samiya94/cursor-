package com.interviewPlatform.repositories;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.interviewPlatform.entities.Student;

public interface StudentRepository extends JpaRepository<Student, Long> {
    Optional<Student> findByUserEmail(String email);
    List<Student> findByDepartmentId(Long departmentId);
    List<Student> findByInstituteId(Long instituteId);

    Optional<Student> findByUserId(Long userId);
}
