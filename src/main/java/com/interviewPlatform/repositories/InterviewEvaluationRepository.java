package com.interviewPlatform.repositories;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.interviewPlatform.entities.InterviewEvaluation;

public interface InterviewEvaluationRepository extends JpaRepository<InterviewEvaluation, Long> {
    Optional<InterviewEvaluation> findByApplicationId(Long applicationId);
    boolean existsByApplicationId(Long applicationId);
    long countByInterviewerId(Long interviewerId);
}
