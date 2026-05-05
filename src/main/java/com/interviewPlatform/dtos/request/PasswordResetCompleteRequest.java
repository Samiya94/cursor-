package com.interviewPlatform.dtos.request;

public record PasswordResetCompleteRequest(String email, String newPassword) {
}
