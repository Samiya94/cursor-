package com.interviewPlatform.dtos.response;

public record AuthResponse(
    String accessToken,
    String refreshToken,
    String email,
    String role
) {

}
