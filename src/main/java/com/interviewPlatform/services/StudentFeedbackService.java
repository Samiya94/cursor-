package com.interviewPlatform.services;

import java.util.List;

import com.interviewPlatform.dtos.request.SubmitInterviewerRatingDTO;
import com.interviewPlatform.dtos.response.StudentFeedbackReportDTO;

public interface StudentFeedbackService {
    List<StudentFeedbackReportDTO> getMyFeedbackReports(String studentEmail);
    StudentFeedbackReportDTO getFeedbackReport(String studentEmail, Long applicationId);
    void submitInterviewerRating(String studentEmail, SubmitInterviewerRatingDTO dto);

    /** For institute dashboard: fetch all feedback reports for a given student by their ID */
    List<StudentFeedbackReportDTO> getFeedbackReportsByStudentId(Long studentId);
}