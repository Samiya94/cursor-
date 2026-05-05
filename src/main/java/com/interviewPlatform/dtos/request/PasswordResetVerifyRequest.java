package com.interviewPlatform.dtos.request;

public record PasswordResetVerifyRequest(String email, String otp) {
}
