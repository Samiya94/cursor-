package com.interviewPlatform.services.Impl;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.interviewPlatform.dtos.request.SubmitInterviewerRatingDTO;
import com.interviewPlatform.dtos.response.InterviewEvaluationResponseDTO;
import com.interviewPlatform.dtos.response.StudentFeedbackReportDTO;
import com.interviewPlatform.entities.InterviewEvaluation;
import com.interviewPlatform.entities.Interviewer;
import com.interviewPlatform.entities.Student;
import com.interviewPlatform.entities.StudentApplication;
import com.interviewPlatform.entities.StudentInterviewerRating;
import com.interviewPlatform.repositories.InterviewEvaluationRepository;
import com.interviewPlatform.repositories.StudentApplicationRepository;
import com.interviewPlatform.repositories.StudentInterviewerRatingRepository;
import com.interviewPlatform.repositories.StudentRepository;
import com.interviewPlatform.services.StudentFeedbackService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class StudentFeedbackServiceImpl implements StudentFeedbackService {

    private final StudentRepository studentRepository;
    private final StudentApplicationRepository applicationRepository;
    private final InterviewEvaluationRepository evaluationRepository;
    private final StudentInterviewerRatingRepository ratingRepository;

    @Override
    public List<StudentFeedbackReportDTO> getMyFeedbackReports(String studentEmail) {
        Student student = studentRepository.findByUserEmail(studentEmail)
                .orElseThrow(() -> new RuntimeException("Student not found"));
        return applicationRepository.findByStudentId(student.getId()).stream()
                .filter(app -> evaluationRepository.findByApplicationId(app.getId()).isPresent())
                .map(this::mapToReport)
                .toList();
    }

    @Override
    public StudentFeedbackReportDTO getFeedbackReport(String studentEmail, Long applicationId) {
        Student student = studentRepository.findByUserEmail(studentEmail)
                .orElseThrow(() -> new RuntimeException("Student not found"));
        StudentApplication app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new RuntimeException("Application not found"));
        if (!app.getStudent().getId().equals(student.getId())) {
            throw new RuntimeException("Access denied");
        }
        return mapToReport(app);
    }

    /**
     * Used by the institute dashboard to view all feedback reports for a specific student.
     * Returns ALL applications (with or without evaluation) so the institute can see
     * interview history, status, recordings, and feedback in one call.
     */
    @Override
    public List<StudentFeedbackReportDTO> getFeedbackReportsByStudentId(Long studentId) {
        return applicationRepository.findByStudentId(studentId).stream()
                .map(this::mapToReport)
                .toList();
    }

    @Override
    @Transactional
    public void submitInterviewerRating(String studentEmail, SubmitInterviewerRatingDTO dto) {
        if (dto.rating() == null || dto.rating() < 1 || dto.rating() > 5) {
            throw new RuntimeException("Rating must be between 1 and 5");
        }
        Student student = studentRepository.findByUserEmail(studentEmail)
                .orElseThrow(() -> new RuntimeException("Student not found"));
        StudentApplication app = applicationRepository.findById(dto.applicationId())
                .orElseThrow(() -> new RuntimeException("Application not found"));
        if (!app.getStudent().getId().equals(student.getId())) {
            throw new RuntimeException("Access denied");
        }
        Interviewer interviewer = app.getAssignedInterviewer();
        if (interviewer == null) {
            throw new RuntimeException("No interviewer assigned for this application");
        }

        StudentInterviewerRating rating = ratingRepository.findByApplicationId(app.getId())
                .orElse(new StudentInterviewerRating());
        rating.setApplication(app);
        rating.setStudent(student);
        rating.setInterviewer(interviewer);
        rating.setRating(dto.rating());
        rating.setFeedback(dto.feedback());
        ratingRepository.save(rating);
    }

    private StudentFeedbackReportDTO mapToReport(StudentApplication app) {
        var req = app.getInterviewRequest();
        Interviewer assigned = app.getAssignedInterviewer();
        String interviewerName = assigned != null ? assigned.getFullName() : null;
        Long interviewerId = assigned != null ? assigned.getId() : null;

        InterviewEvaluationResponseDTO evalDto = evaluationRepository.findByApplicationId(app.getId())
                .map(this::mapEval)
                .orElse(null);

        var ratingOpt = ratingRepository.findByApplicationId(app.getId());
        String videoUrl = app.getVideoUrl();
        String publicVideoUrl = (videoUrl != null && !videoUrl.isBlank()) ? "/uploads/" + videoUrl : null;

        // Domain name: first expertise entry from the interview request
        var expertise = req.getExpertise();
        String domainName = (expertise != null && !expertise.isEmpty()) ? expertise.get(0) : null;

        return new StudentFeedbackReportDTO(
                app.getId(),
                req.getId(),
                req.getDepartmentName(),
                domainName,
                req.getScheduledDate(),
                req.getScheduledVenue(),
                interviewerName,
                interviewerId,
                app.getStatus().name(),
                publicVideoUrl,
                evalDto,
                ratingOpt.isPresent(),
                ratingOpt.map(StudentInterviewerRating::getRating).orElse(null),
                ratingOpt.map(StudentInterviewerRating::getFeedback).orElse(null)
        );
    }

    private InterviewEvaluationResponseDTO mapEval(InterviewEvaluation eval) {
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