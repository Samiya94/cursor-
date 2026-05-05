package com.interviewPlatform.repositories;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.interviewPlatform.entities.Department;
import com.interviewPlatform.entities.Mentor;

public interface MentorRepository extends JpaRepository<Mentor,Long> {
    boolean existsByDepartment(Department department);
    List<Mentor> findByInstituteId(Long instituteID);
    Optional<Mentor> findByUserEmail(String email);

}
