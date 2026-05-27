package com.interviewPlatform.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.interviewPlatform.dtos.request.SubmitInterviewEvaluationDTO;
import com.interviewPlatform.dtos.response.InterviewEvaluationResponseDTO;
import com.interviewPlatform.services.InterviewEvaluationService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/interviewer/evaluations")
@RequiredArgsConstructor
public class InterviewEvaluationController {

    private final InterviewEvaluationService evaluationService;

    @PreAuthorize("hasRole('INTERVIEWER')")
    @PostMapping
    public ResponseEntity<InterviewEvaluationResponseDTO> submit(
            Authentication auth,
            @RequestBody SubmitInterviewEvaluationDTO dto) {
        return ResponseEntity.ok(evaluationService.submitEvaluation(auth.getName(), dto));
    }

    @PreAuthorize("hasAnyRole('INTERVIEWER','STUDENT','ADMIN','INSTITUTE','MENTOR')")
    @GetMapping("/application/{applicationId}")
    public ResponseEntity<InterviewEvaluationResponseDTO> getByApplication(@PathVariable Long applicationId) {
        InterviewEvaluationResponseDTO dto = evaluationService.getByApplicationId(applicationId);
        if (dto == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(dto);
    }
}
