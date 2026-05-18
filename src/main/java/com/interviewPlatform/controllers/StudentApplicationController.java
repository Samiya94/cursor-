package com.interviewPlatform.controllers;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.interviewPlatform.dtos.response.StudentApplicationResponseDTO;
import com.interviewPlatform.enums.Status;
import com.interviewPlatform.services.StudentApplicationService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/applications")
@RequiredArgsConstructor
public class StudentApplicationController {

    private final StudentApplicationService applicationService;

    // Student applies to an interview
    @PreAuthorize("hasRole('STUDENT')")
    @PostMapping("/{interviewRequestId}/apply")
    public ResponseEntity<String> apply(
            @PathVariable Long interviewRequestId,
            Authentication auth) {
        applicationService.applyToInterview(interviewRequestId, auth.getName());
        return ResponseEntity.ok("Application submitted successfully");
    }

    // Student withdraws their application
    @PreAuthorize("hasRole('STUDENT')")
    @DeleteMapping("/{applicationId}/withdraw")
    public ResponseEntity<String> withdraw(
            @PathVariable Long applicationId,
            Authentication auth) {
        applicationService.withdrawApplication(applicationId, auth.getName());
        return ResponseEntity.ok("Application withdrawn");
    }

    // Student sees their own applications
    @PreAuthorize("hasRole('STUDENT')")
    @GetMapping("/my")
    public ResponseEntity<List<StudentApplicationResponseDTO>> myApplications(Authentication auth) {
        return ResponseEntity.ok(applicationService.getMyApplications(auth.getName()));
    }

    // Institute / Mentor / Admin sees applicants for a specific interview
    @PreAuthorize("hasAnyRole('INSTITUTE', 'MENTOR', 'ADMIN', 'INTERVIEWER')")
    @GetMapping("/interview/{interviewRequestId}")
    public ResponseEntity<List<StudentApplicationResponseDTO>> getApplicants(
            @PathVariable Long interviewRequestId) {
        return ResponseEntity.ok(applicationService.getApplicantsForInterview(interviewRequestId));
    }

    // Admin can still manually reject a confirmed student if needed (e.g. no-show, disqualified)
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{applicationId}/reject")
    public ResponseEntity<String> reject(@PathVariable Long applicationId) {
        applicationService.updateApplicationStatus(applicationId, Status.REJECTED);
        return ResponseEntity.ok("Application rejected");
    }
}