package com.interviewPlatform.controllers;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.interviewPlatform.dtos.request.SubmitInterviewerRatingDTO;
import com.interviewPlatform.dtos.response.StudentFeedbackReportDTO;
import com.interviewPlatform.services.StudentFeedbackService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/student/feedback")
@RequiredArgsConstructor
public class StudentFeedbackController {

    private final StudentFeedbackService feedbackService;

    @PreAuthorize("hasRole('STUDENT')")
    @GetMapping("/reports")
    public ResponseEntity<List<StudentFeedbackReportDTO>> myReports(Authentication auth) {
        return ResponseEntity.ok(feedbackService.getMyFeedbackReports(auth.getName()));
    }

    @PreAuthorize("hasRole('STUDENT')")
    @GetMapping("/reports/{applicationId}")
    public ResponseEntity<StudentFeedbackReportDTO> getReport(
            Authentication auth,
            @PathVariable Long applicationId) {
        return ResponseEntity.ok(feedbackService.getFeedbackReport(auth.getName(), applicationId));
    }

    @PreAuthorize("hasRole('STUDENT')")
    @PostMapping("/ratings")
    public ResponseEntity<String> submitRating(
            Authentication auth,
            @RequestBody SubmitInterviewerRatingDTO dto) {
        feedbackService.submitInterviewerRating(auth.getName(), dto);
        return ResponseEntity.ok("Rating submitted");
    }
}
