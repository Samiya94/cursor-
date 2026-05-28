package com.interviewPlatform.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.interviewPlatform.dtos.request.StudentProfileUpdateRequestDTO;
import com.interviewPlatform.dtos.response.EmailCheckResponse;
import com.interviewPlatform.dtos.response.StudentProfileResponseDTO;
import com.interviewPlatform.dtos.response.StudentResumeResponseDTO;
import com.interviewPlatform.repositories.UserRepository;
import com.interviewPlatform.services.StudentService;
import com.interviewPlatform.dtos.request.ChangePasswordRequestDTO;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/students")
@RequiredArgsConstructor
public class StudentController {
    private final StudentService studentService;
    private final UserRepository userRepository;


    
    @GetMapping("/me")
    public ResponseEntity<StudentProfileResponseDTO> getProfile(Authentication authentication) {
        return ResponseEntity.ok(studentService.getMyProfile(authentication.getName()));
    }

    @PutMapping("/me")
    public ResponseEntity<StudentProfileResponseDTO> updateProfile(
            Authentication authentication,
            @jakarta.validation.Valid @RequestBody StudentProfileUpdateRequestDTO request) {
        return ResponseEntity.ok(studentService.updateMyProfile(authentication.getName(), request));
    }

    @PutMapping("/me/password")
    public ResponseEntity<String> changePassword(
            Authentication authentication,
            @jakarta.validation.Valid @RequestBody ChangePasswordRequestDTO request) {
        studentService.changePassword(authentication.getName(), request);
        return ResponseEntity.ok("Password updated successfully");
    }

    @GetMapping("/check-email")
    public ResponseEntity<EmailCheckResponse> checkEmail(@RequestParam String email) {
        return ResponseEntity.ok(new EmailCheckResponse(userRepository.existsByEmail(email)));
    }

    @GetMapping("/me/resume")
    public ResponseEntity<StudentResumeResponseDTO> getMyResume(Authentication authentication) {
        return ResponseEntity.ok(studentService.getMyResume(authentication.getName()));
    }

    @PostMapping(value = "/me/resume", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<StudentResumeResponseDTO> uploadResume(
            Authentication authentication,
            @RequestPart("resume") MultipartFile resumeFile) {
        return ResponseEntity.ok(studentService.uploadMyResume(authentication.getName(), resumeFile));
    }
}
