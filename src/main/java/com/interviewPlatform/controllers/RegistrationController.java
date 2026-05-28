package com.interviewPlatform.controllers;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.interviewPlatform.dtos.request.InstituteRegisterRequest;
import com.interviewPlatform.dtos.request.InterviewerRegisterRequest;
import com.interviewPlatform.dtos.request.MentorRegisterRequest;
import com.interviewPlatform.dtos.request.StudentRegisterRequestDTO;
import com.interviewPlatform.dtos.response.StudentRegistrationInfoResponse;
import com.interviewPlatform.entities.Department;
import com.interviewPlatform.entities.Institute;
import com.interviewPlatform.repositories.DepartmentRepository;
import com.interviewPlatform.repositories.InstituteRepository;
import com.interviewPlatform.services.AuthService;
import com.interviewPlatform.services.MentorService;
import com.interviewPlatform.services.StudentService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/register")
@RequiredArgsConstructor
public class RegistrationController {

    private final AuthService authService;
    private final MentorService mentorService;
    private final StudentService studentService;
    private final InstituteRepository instituteRepository;
    private final DepartmentRepository departmentRepository;

    @PostMapping("/institute")
    public ResponseEntity<?> registerInstitute(@jakarta.validation.Valid @RequestBody InstituteRegisterRequest request) {
        authService.registerInstitute(request);
        return ResponseEntity.ok("Institute Registered Successfully");
    }

    @PostMapping("/interviewer")
    public ResponseEntity<?> registerInterviewer(@jakarta.validation.Valid @ModelAttribute InterviewerRegisterRequest request) {
        try {
            authService.registerInterviewer(request);
            return ResponseEntity.ok("Interviewer Registered Successfully");
        } catch (RuntimeException ex) {
            if (ex.getMessage().contains("Email already exists")) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(ex.getMessage());
            }
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @PostMapping("/mentor")
    public ResponseEntity<?> registerMentor(@jakarta.validation.Valid @RequestBody MentorRegisterRequest request) {
        try {
            mentorService.registerMentor(request);
            return ResponseEntity.ok("Mentor registered successfully");
        } catch (RuntimeException ex) {
            if (ex.getMessage().contains("Mentor already exists")) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(ex.getMessage());
            }
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @PostMapping("/student")
    public ResponseEntity<String> registerStudent(@jakarta.validation.Valid @RequestBody StudentRegisterRequestDTO request) {
        studentService.registerStudent(request);
        return ResponseEntity.ok("Student registered successfully");
    }

    @GetMapping("/info")
    public ResponseEntity<StudentRegistrationInfoResponse> getRegistrationInfo(
            @RequestParam Long instituteId,
            @RequestParam(required = false) Long deptId) {

        Institute institute = instituteRepository.findById(instituteId)
                .orElseThrow(() -> new RuntimeException("Institute not found"));

        String deptName = "";
        Long resolvedDeptId = null;

        if (deptId != null) {
            Department dept = departmentRepository.findById(deptId)
                    .orElseThrow(() -> new RuntimeException("Department not found"));
            deptName = dept.getName();
            resolvedDeptId = dept.getId();
        }

        return ResponseEntity.ok(new StudentRegistrationInfoResponse(
                institute.getId(),
                institute.getInstituteName(),
                resolvedDeptId,
                deptName
        ));
    }
}