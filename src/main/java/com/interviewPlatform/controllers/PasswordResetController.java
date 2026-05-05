package com.interviewPlatform.controllers;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.interviewPlatform.dtos.request.PasswordResetCompleteRequest;
import com.interviewPlatform.dtos.request.PasswordResetEmailRequest;
import com.interviewPlatform.dtos.request.PasswordResetVerifyRequest;
import com.interviewPlatform.services.PasswordResetService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/password-reset")
@RequiredArgsConstructor
public class PasswordResetController {

    private final PasswordResetService passwordResetService;

    @PostMapping("/request")
    public ResponseEntity<Map<String, String>> request(@RequestBody PasswordResetEmailRequest body) {
        passwordResetService.requestOtp(body.email());
        return ResponseEntity.ok(Map.of("message", "If this email is registered, a reset code has been sent."));
    }

    @PostMapping("/verify")
    public ResponseEntity<Map<String, String>> verify(@RequestBody PasswordResetVerifyRequest body) {
        passwordResetService.verifyOtp(body.email(), body.otp());
        return ResponseEntity.ok(Map.of("message", "Code verified."));
    }

    @PostMapping("/complete")
    public ResponseEntity<Map<String, String>> complete(@RequestBody PasswordResetCompleteRequest body) {
        passwordResetService.completeReset(body.email(), body.newPassword());
        return ResponseEntity.ok(Map.of("message", "Password updated."));
    }
}
