package com.interviewPlatform.services.Impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.interviewPlatform.dtos.request.SubmitInterviewEvaluationDTO;
import com.interviewPlatform.dtos.response.InterviewEvaluationResponseDTO;
import com.interviewPlatform.entities.InterviewEvaluation;
import com.interviewPlatform.entities.Interviewer;
import com.interviewPlatform.entities.StudentApplication;
import com.interviewPlatform.repositories.InterviewEvaluationRepository;
import com.interviewPlatform.repositories.InterviewerRepository;
import com.interviewPlatform.repositories.StudentApplicationRepository;
import com.interviewPlatform.repositories.InterviewRequestRepository;
import com.interviewPlatform.services.InterviewEvaluationService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class InterviewEvaluationServiceImpl implements InterviewEvaluationService {

    private final InterviewEvaluationRepository evaluationRepository;
    private final StudentApplicationRepository applicationRepository;
    private final InterviewerRepository interviewerRepository;
    private final InterviewRequestRepository interviewRequestRepository;

    @Override
    @Transactional
    public InterviewEvaluationResponseDTO submitEvaluation(String interviewerEmail, SubmitInterviewEvaluationDTO dto) {
        Interviewer interviewer = interviewerRepository.findByUserEmail(interviewerEmail)
                .orElseThrow(() -> new RuntimeException("Interviewer not found"));

        StudentApplication app = applicationRepository.findById(dto.applicationId())
                .orElseThrow(() -> new RuntimeException("Application not found"));

        if (app.getAssignedInterviewer() == null
                || !app.getAssignedInterviewer().getId().equals(interviewer.getId())) {
            throw new RuntimeException("You are not assigned to interview this student");
        }

        InterviewEvaluation eval = evaluationRepository.findByApplicationId(app.getId())
                .orElse(new InterviewEvaluation());
        eval.setApplication(app);
        eval.setInterviewer(interviewer);
        eval.setTechnicalScore(dto.technicalScore());
        eval.setCommunicationScore(dto.communicationScore());
        eval.setDomainScore(dto.domainScore());
        eval.setApproachScore(dto.approachScore());
        eval.setConfidenceScore(dto.confidenceScore());
        eval.setOverallPerformance(dto.overallPerformance());
        eval.setStrengths(dto.strengths());
        eval.setImprovements(dto.improvements());
        eval.setRemarks(dto.remarks());
        eval.setOverallScore(computeOverallScore(dto));

        InterviewEvaluation saved = evaluationRepository.save(eval);

        // Update the InterviewRequest status to COMPLETED if it isn't already
        com.interviewPlatform.entities.InterviewRequest req = app.getInterviewRequest();
        if (req != null && req.getStatus() != com.interviewPlatform.enums.Status.COMPLETED) {
            req.setStatus(com.interviewPlatform.enums.Status.COMPLETED);
            interviewRequestRepository.save(req);
        }

        return mapToDTO(saved);
    }

    @Override
    public InterviewEvaluationResponseDTO getByApplicationId(Long applicationId) {
        return evaluationRepository.findByApplicationId(applicationId)
                .map(this::mapToDTO)
                .orElse(null);
    }

    private double computeOverallScore(SubmitInterviewEvaluationDTO dto) {
        java.util.List<Integer> scores = java.util.Arrays.asList(
                dto.technicalScore(),
                dto.communicationScore(),
                dto.domainScore(),
                dto.approachScore(),
                dto.confidenceScore()
        ).stream().filter(java.util.Objects::nonNull).toList();
        if (scores.isEmpty()) {
            return 0;
        }
        double sum = scores.stream().mapToInt(Integer::intValue).sum();
        return Math.round((sum / scores.size()) * 10.0) / 10.0;
    }

    private InterviewEvaluationResponseDTO mapToDTO(InterviewEvaluation eval) {
        return new InterviewEvaluationResponseDTO(
                eval.getId(),
                eval.getApplication().getId(),
                eval.getInterviewer().getFullName(),
                eval.getTechnicalScore(),
                eval.getCommunicationScore(),
                eval.getDomainScore(),
                eval.getApproachScore(),
                eval.getConfidenceScore(),
                eval.getOverallPerformance(),
                eval.getStrengths(),
                eval.getImprovements(),
                eval.getRemarks(),
                eval.getOverallScore(),
                eval.getCreatedAt()
        );
    }
}
