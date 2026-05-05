package com.interviewPlatform.dtos.request;

public record ChangePasswordRequestDTO(
        String currentPassword,
        String newPassword,
        String confirmPassword
) {
}
