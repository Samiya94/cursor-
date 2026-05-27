package com.interviewPlatform.services;

import com.interviewPlatform.dtos.request.SubmitInterviewEvaluationDTO;
import com.interviewPlatform.dtos.response.InterviewEvaluationResponseDTO;

public interface InterviewEvaluationService {
    InterviewEvaluationResponseDTO submitEvaluation(String interviewerEmail, SubmitInterviewEvaluationDTO dto);
    InterviewEvaluationResponseDTO getByApplicationId(Long applicationId);
}
