package com.interviewPlatform.controllers;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.interviewPlatform.entities.Institute;
import com.interviewPlatform.entities.Interviewer;
import com.interviewPlatform.entities.User;
import com.interviewPlatform.enums.Status;
import com.interviewPlatform.repositories.InstituteRepository;
import com.interviewPlatform.repositories.InterviewRequestRepository;
import com.interviewPlatform.repositories.InterviewerRepository;
import com.interviewPlatform.repositories.StudentRepository;
import com.interviewPlatform.repositories.UserRepository;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserRepository userRepository;
    private final InstituteRepository instituteRepository;
    private final InterviewerRepository interviewerRepository;
    private final StudentRepository studentRepository;
    private final InterviewRequestRepository interviewRequestRepository;

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        long activeInterviewers = interviewerRepository.findAll().stream()
            .filter(iv -> iv.getUser() != null && iv.getUser().getStatus() == Status.ACTIVE)
            .count();

        return ResponseEntity.ok(Map.of(
            "totalInstitutes", instituteRepository.count(),
            "totalInterviewers", interviewerRepository.count(),
            "activeInterviewers", activeInterviewers,
            "totalStudents", studentRepository.count(),
            "totalRequests", interviewRequestRepository.count(),
            "pendingInterviewers", interviewerRepository.findByUserStatus(Status.PENDING).size(),
            "confirmedRequests", interviewRequestRepository.findByStatus(Status.CONFIRMED).size(),
            "pendingRequests", interviewRequestRepository.findByStatus(Status.PENDING).size()
        ));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/monthly-stats")
    public ResponseEntity<Map<String, Object>> getMonthlyStats() {
        String[] months = {"Jan", "Feb", "Mar", "Apr", "May", "Jun",
                           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
        int currentYear = LocalDateTime.now().getYear();
        int currentMonth = LocalDateTime.now().getMonthValue();

        List<String> labels = new ArrayList<>();
        List<Long> counts = new ArrayList<>();

        // Last 6 months
        for (int i = 5; i >= 0; i--) {
            int month = currentMonth - i;
            int year = currentYear;
            if (month <= 0) { month += 12; year -= 1; }

            LocalDateTime start = LocalDateTime.of(year, month, 1, 0, 0);
            LocalDateTime end = start.plusMonths(1);

            long count = interviewRequestRepository.findAll().stream()
                .filter(r -> r.getCreatedAt() != null
                    && r.getCreatedAt().isAfter(start)
                    && r.getCreatedAt().isBefore(end))
                .count();

            labels.add(months[month - 1]);
            counts.add(count);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("labels", labels);
        result.put("counts", counts);
        return ResponseEntity.ok(result);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/institutes")
    public ResponseEntity<?> getAllInstitutes() {
        return ResponseEntity.ok(instituteRepository.findAll());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/interviewers")
    public ResponseEntity<?> getAllInterviewers() {
        return ResponseEntity.ok(interviewerRepository.findAll());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/interviewers/active")
    public ResponseEntity<List<Interviewer>> getActiveInterviewers() {
        List<Interviewer> active = interviewerRepository.findAll().stream()
            .filter(iv -> iv.getUser() != null && iv.getUser().getStatus() == Status.ACTIVE)
            .toList();
        return ResponseEntity.ok(active);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/interviewers/pending")
    public ResponseEntity<List<Interviewer>> getPendingInterviewers() {
        return ResponseEntity.ok(interviewerRepository.findByUserStatus(Status.PENDING));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/interviewers/{id}/approve")
    public ResponseEntity<String> approveInterviewer(@PathVariable Long id) {
        Interviewer interviewer = interviewerRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Interviewer not found"));
        User user = interviewer.getUser();
        user.setStatus(Status.ACTIVE);
        userRepository.save(user);
        return ResponseEntity.ok("Interviewer approved successfully");
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/interviewers/{id}/reject")
    public ResponseEntity<String> rejectInterviewer(@PathVariable Long id) {
        Interviewer interviewer = interviewerRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Interviewer not found"));
        User user = interviewer.getUser();
        user.setStatus(Status.INACTIVE);
        userRepository.save(user);
        return ResponseEntity.ok("Interviewer rejected");
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/interview-requests")
    public ResponseEntity<?> getAllRequests() {
        return ResponseEntity.ok(interviewRequestRepository.findAll());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/profile")
    public ResponseEntity<Map<String, Object>> getAdminProfile(org.springframework.security.core.Authentication auth) {
        User user = userRepository.findByEmail(auth.getName())
            .orElseThrow(() -> new RuntimeException("Admin not found"));
        java.util.Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("email", user.getEmail());
        result.put("fullName", "Super Admin");
        result.put("phone", "");
        result.put("role", user.getRole() != null ? user.getRole().name() : "ADMIN");
        result.put("status", user.getStatus() != null ? user.getStatus().name() : "ACTIVE");
        return ResponseEntity.ok(result);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/profile")
    public ResponseEntity<String> updateAdminProfile(
            org.springframework.security.core.Authentication auth,
            @RequestBody Map<String, String> body) {
        // Admin profile fields (fullName/phone) are not stored in User entity yet.
        // This endpoint is a placeholder for future extension.
        return ResponseEntity.ok("Profile updated");
    }
}