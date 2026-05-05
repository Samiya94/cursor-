package com.interviewPlatform.services;

import java.util.List;

import com.interviewPlatform.dtos.response.StudentApplicationResponseDTO;
import com.interviewPlatform.enums.Status;

public interface StudentApplicationService {
    void applyToInterview(Long interviewRequestId, String studentEmail);
    void withdrawApplication(Long applicationId, String studentEmail);
    List<StudentApplicationResponseDTO> getMyApplications(String studentEmail);
    List<StudentApplicationResponseDTO> getApplicantsForInterview(Long interviewRequestId);
    void updateApplicationStatus(Long applicationId, Status status);
}