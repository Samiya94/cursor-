package com.interviewPlatform.controllers;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.interviewPlatform.dtos.request.InterviewRequestDTO;
import com.interviewPlatform.dtos.request.AssignInterviewerDTO;
import com.interviewPlatform.dtos.request.ScheduleInterviewDTO;
import com.interviewPlatform.dtos.response.InterviewRequestResponseDTO;
import com.interviewPlatform.enums.Status;
import com.interviewPlatform.services.InterviewRequestService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/interview-requests")
@RequiredArgsConstructor
public class InterviewRequestController {
    private final InterviewRequestService interviewRequestService;

    @PostMapping
    public ResponseEntity<String> createRequest(
            @RequestBody InterviewRequestDTO dto) {

        interviewRequestService.createRequest(dto);

        return ResponseEntity.ok("Interview request submitted successfully");
    }

    @GetMapping
    public ResponseEntity<List<InterviewRequestResponseDTO>> getRequests() {
        return ResponseEntity.ok(
                interviewRequestService.getMyRequests()
        );
    }

    @GetMapping("/pending-count")
    public ResponseEntity<Long> getPendingCount() {
        return ResponseEntity.ok(
                interviewRequestService.getPendingCount()
        );
    }

    @PreAuthorize("hasRole('INSTITUTE')")
    @PutMapping("/{id}/confirm")
    public ResponseEntity<String> confirmRequest(@PathVariable Long id){
        interviewRequestService.confirmByInstitute(id);
        return ResponseEntity.ok("Request Confirmed");
    }

    @PreAuthorize("hasRole('INSTITUTE')")
    @PutMapping("/{id}/reject-reschedule")
    public ResponseEntity<String> rejectReschedule(@PathVariable Long id) {
        interviewRequestService.rejectRescheduleByInstitute(id);
        return ResponseEntity.ok("Rescheduled request rejected");
    }

    @PreAuthorize("hasRole('INSTITUTE')")
    @PutMapping("/{id}/cancel")
    public ResponseEntity<String> cancelRequest(@PathVariable Long id){
        interviewRequestService.updateStatusByInstitute(id, Status.CANCELLED);
        return ResponseEntity.ok("Request Cancelled");
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<String> updateRequestStatus(
            @PathVariable Long id,
            @RequestParam String status) {
        Status parsedStatus = parseStatus(status);
        interviewRequestService.updateStatus(id, parsedStatus);
        return ResponseEntity.ok("Request status updated to " + parsedStatus);
    }

        // Admin: Get all interview requests
        @PreAuthorize("hasRole('ADMIN')")
        @GetMapping("/all")
        public ResponseEntity<List<InterviewRequestResponseDTO>> getAllRequests() {
            return ResponseEntity.ok(interviewRequestService.getAllRequests());
        }

        // Admin: Schedule an interview
        @PreAuthorize("hasRole('ADMIN')")
        @PutMapping("/{id}/schedule")
        public ResponseEntity<?> scheduleInterview(
                @PathVariable Long id,
                @RequestBody ScheduleInterviewDTO dto) {
            try {
                interviewRequestService.scheduleInterview(id, dto);
                return ResponseEntity.ok(Map.of("message", "Interview scheduled successfully"));
            } catch (RuntimeException e) {
                String msg = e.getMessage();
                return ResponseEntity.badRequest().body(Map.of("message",
                        msg != null && !msg.isBlank() ? msg : "Scheduling failed."));
            }
        }

        // Admin: Reschedule an interview
        @PreAuthorize("hasRole('ADMIN')")
        @PutMapping("/{id}/reschedule")
        public ResponseEntity<?> rescheduleInterview(
                @PathVariable Long id,
                @RequestBody ScheduleInterviewDTO dto) {
            try {
                interviewRequestService.rescheduleInterview(id, dto);
                return ResponseEntity.ok(Map.of("message", "Interview rescheduled successfully"));
            } catch (RuntimeException e) {
                String msg = e.getMessage();
                return ResponseEntity.badRequest().body(Map.of("message",
                        msg != null && !msg.isBlank() ? msg : "Rescheduling failed."));
            }
        }

        @PreAuthorize("hasRole('ADMIN')")
        @PutMapping("/{id}/assign-interviewer")
        public ResponseEntity<String> assignInterviewer(
                @PathVariable Long id,
                @RequestBody AssignInterviewerDTO dto) {
            interviewRequestService.assignInterviewer(id, dto.interviewerIds());
            return ResponseEntity.ok("Interviewer assigned successfully");
        }


    private Status parseStatus(String status) {
        if (status == null || status.isBlank()) {
            throw new RuntimeException("Status is required");
        }

        String normalized = status.trim().toUpperCase();
        if ("CANCEL".equals(normalized)) {
            return Status.CANCELLED;
        }

        try {
            return Status.valueOf(normalized);
        } catch (IllegalArgumentException ex) {
            throw new RuntimeException("Invalid status value: " + status);
        }
    }

}
