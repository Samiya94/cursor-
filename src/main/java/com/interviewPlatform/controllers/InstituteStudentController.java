package com.interviewPlatform.controllers;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.interviewPlatform.dtos.response.StudentFeedbackReportDTO;
import com.interviewPlatform.services.StudentFeedbackService;

import lombok.RequiredArgsConstructor;

/**
 * Institute-facing endpoints for viewing student data in the institute dashboard.
 */
@RestController
@RequestMapping("/api/institute/students")
@RequiredArgsConstructor
public class InstituteStudentController {

    private final StudentFeedbackService feedbackService;

    /**
     * Returns all feedback reports (interviews, evaluations, recordings) for a student.
     * Used by the institute dashboard student detail modal (Overview / Feedback / Interviews / Recording tabs).
     */
    @PreAuthorize("hasRole('INSTITUTE')")
    @GetMapping("/{studentId}/feedback-reports")
    public ResponseEntity<List<StudentFeedbackReportDTO>> getStudentFeedbackReports(
            @PathVariable Long studentId) {
        return ResponseEntity.ok(feedbackService.getFeedbackReportsByStudentId(studentId));
    }
}