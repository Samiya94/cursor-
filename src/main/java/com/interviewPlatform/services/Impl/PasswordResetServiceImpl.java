package com.interviewPlatform.services.Impl;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.interviewPlatform.entities.PasswordResetOtp;
import com.interviewPlatform.entities.User;
import com.interviewPlatform.repositories.PasswordResetOtpRepository;
import com.interviewPlatform.repositories.UserRepository;
import com.interviewPlatform.services.PasswordResetService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PasswordResetServiceImpl implements PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetServiceImpl.class);
    private static final int OTP_EXPIRY_MINUTES = 15;
    private static final int COMPLETE_DEADLINE_MINUTES = 30;

    private final UserRepository userRepository;
    private final PasswordResetOtpRepository otpRepository;
    private final PasswordEncoder passwordEncoder;
    private final JavaMailSender mailSender;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${app.mail.from:${spring.mail.username:no-reply@interview-platform.local}}")
    private String fromEmail;

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim();
    }

    @Override
    @Transactional
    public void requestOtp(String email) {
        String normalized = normalizeEmail(email);
        if (normalized.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please enter your email address.");
        }

        Optional<User> user = userRepository.findByEmail(normalized);
        if (user.isEmpty()) {
            log.debug("Password reset requested for unregistered email.");
            return;
        }

        String code = String.format("%06d", secureRandom.nextInt(1_000_000));

        PasswordResetOtp row = otpRepository.findByEmail(normalized)
                .orElseGet(() -> {
                    PasswordResetOtp otp = new PasswordResetOtp();
                    otp.setEmail(normalized);
                    return otp;
                });

        row.setCode(code);
        row.setExpiresAt(Instant.now().plus(OTP_EXPIRY_MINUTES, ChronoUnit.MINUTES));
        row.setVerifiedAt(null);
        otpRepository.save(row);

        sendOtpEmail(normalized, code);
    }

    private void sendOtpEmail(String email, String code) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setFrom(fromEmail);
        message.setSubject("Your Interview Platform password reset OTP");
        message.setText(
                "Your OTP for password reset is: " + code + "\n\n"
                        + "This code is valid for 15 minutes.\n"
                        + "If you did not request this, you can ignore this email.");
        try {
            mailSender.send(message);
            log.info("Password reset OTP email sent to {}", email);
        } catch (MailException e) {
            log.error("Failed to send password reset OTP email to {}", email, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to send reset code right now. Please try again.");
        }
    }

    @Override
    @Transactional
    public void verifyOtp(String email, String otp) {
        String normalized = normalizeEmail(email);
        String digits = otp == null ? "" : otp.replaceAll("\\D", "");

        PasswordResetOtp row = otpRepository.findByEmail(normalized)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "No reset code found. Request a new OTP."));

        if (row.getExpiresAt().isBefore(Instant.now())) {
            otpRepository.delete(row);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This code has expired. Request a new OTP.");
        }

        if (!row.getCode().equals(digits)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Incorrect code. Please try again.");
        }

        row.setVerifiedAt(Instant.now());
        otpRepository.save(row);
    }

    @Override
    @Transactional
    public void completeReset(String email, String newPassword) {
        String normalized = normalizeEmail(email);

        if (newPassword == null || newPassword.length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 8 characters.");
        }

        PasswordResetOtp row = otpRepository.findByEmail(normalized)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Verification expired. Start again from the email step."));

        if (row.getVerifiedAt() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Please verify your OTP before setting a new password.");
        }

        Instant deadline = row.getVerifiedAt().plus(COMPLETE_DEADLINE_MINUTES, ChronoUnit.MINUTES);
        if (deadline.isBefore(Instant.now())) {
            otpRepository.delete(row);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Reset session expired. Request a new OTP.");
        }

        User user = userRepository.findByEmail(normalized)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "User not found."));

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        otpRepository.delete(row);
    }
}
