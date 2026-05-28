package com.interviewPlatform.dtos.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequestDTO(
        @NotBlank(message = "Current password is required")
        String currentPassword,
        
        @NotBlank(message = "New password is required")
        @Size(min = 6, message = "New password must be at least 6 characters long")
        String newPassword,
        
        @NotBlank(message = "Confirm password is required")
        String confirmPassword
) {
}
