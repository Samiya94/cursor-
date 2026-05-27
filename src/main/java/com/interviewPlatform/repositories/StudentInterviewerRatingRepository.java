package com.interviewPlatform.repositories;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.interviewPlatform.entities.StudentInterviewerRating;

public interface StudentInterviewerRatingRepository extends JpaRepository<StudentInterviewerRating, Long> {
    Optional<StudentInterviewerRating> findByApplicationId(Long applicationId);
    boolean existsByApplicationId(Long applicationId);
    List<StudentInterviewerRating> findByInterviewerId(Long interviewerId);
}
