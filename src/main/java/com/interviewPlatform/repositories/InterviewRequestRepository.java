package com.interviewPlatform.repositories;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.interviewPlatform.entities.InterviewRequest;
import com.interviewPlatform.enums.Status;

public interface InterviewRequestRepository extends JpaRepository<InterviewRequest, Long> {
    List<InterviewRequest> findByInstituteId(Long instituteId);
    long countByInstituteIdAndStatus(Long instituteId, Status status);
    List<InterviewRequest> findByAssignedInterviewerId(Long interviewerId);
    List<InterviewRequest> findByStatus(Status status);
    
    List<InterviewRequest> findByInstituteIdAndStatusIn(Long instituteId, List<Status> statuses);
}