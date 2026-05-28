package com.interviewPlatform.repositories;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.interviewPlatform.entities.StudentApplication;
import com.interviewPlatform.enums.Status;

public interface StudentApplicationRepository extends JpaRepository<StudentApplication, Long> {
    List<StudentApplication> findByStudentId(Long studentId);
    List<StudentApplication> findByInterviewRequestId(Long requestId);
    Optional<StudentApplication> findByStudentIdAndInterviewRequestId(Long studentId, Long requestId);
    boolean existsByStudentIdAndInterviewRequestId(Long studentId, Long requestId);
    long countByInterviewRequestId(Long requestId);
    List<StudentApplication> findByInterviewRequestIdAndStatus(Long requestId, Status status);
    List<StudentApplication> findByVideoUrlIsNotNull();
}