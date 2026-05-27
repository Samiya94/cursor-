package com.interviewPlatform.services;

import com.interviewPlatform.entities.InterviewRequest;
import com.interviewPlatform.entities.StudentApplication;

public interface InterviewerAssignmentService {
    void assignRandomInterviewer(StudentApplication application, InterviewRequest request);
    void assignAllUnassignedForRequest(Long interviewRequestId);
}
