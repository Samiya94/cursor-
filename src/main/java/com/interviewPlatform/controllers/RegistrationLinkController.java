package com.interviewPlatform.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.interviewPlatform.dtos.response.StudentRegistrationInfoResponse;
import com.interviewPlatform.entities.Department;
import com.interviewPlatform.entities.Institute;
import com.interviewPlatform.repositories.DepartmentRepository;
import com.interviewPlatform.repositories.InstituteRepository;
import com.interviewPlatform.services.InstituteService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/register")
@RequiredArgsConstructor
public class RegistrationLinkController {
    private final InstituteService instituteService;
    private final DepartmentRepository departmentRepository;
    private final InstituteRepository instituteRepository;

    public record ValidateRegistrationRequest(Long instId, String token) {
    }

    @GetMapping("/institutes/{id}/registration-link")
    public ResponseEntity<String> generateLink(@PathVariable Long id) {
        String link = instituteService.getOrCreateRegistrationLink(id);
        return ResponseEntity.ok(link);
    }

    

    // Validate token 
    @GetMapping("/validate")
    public ResponseEntity<?> validateToken(
            @RequestParam Long instId,
            @RequestParam String token) {

        boolean isValid = instituteService.validateRegistrationToken(instId, token);

        if (isValid) {
            return ResponseEntity.ok("Valid token");
        } else {
            return ResponseEntity.badRequest().body("Invalid token");
        }
    }

    @PostMapping("/validate-registration")
    public ResponseEntity<Boolean> validateRegistration(@RequestBody ValidateRegistrationRequest request) {
        if (request == null || request.instId() == null || request.token() == null || request.token().isBlank()) {
            return ResponseEntity.ok(false);
        }

        boolean isValid = instituteService.validateRegistrationToken(request.instId(), request.token());
        return ResponseEntity.ok(isValid);
    }

    @GetMapping("/institutes/{id}/student-registration-link")
    public ResponseEntity<String> generateStudentLink(
            @PathVariable Long id,
            @RequestParam Long deptId) {

        String link = instituteService.getStudentRegistrationLink(id, deptId);
        return ResponseEntity.ok(link);
    }

    
}
