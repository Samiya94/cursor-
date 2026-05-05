package com.interviewPlatform.services;

public interface PasswordResetService {

    void requestOtp(String email);

    void verifyOtp(String email, String otp);

    void completeReset(String email, String newPassword);
}
