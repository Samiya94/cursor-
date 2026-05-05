package com.interviewPlatform.controllers;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import org.springframework.web.bind.annotation.RestController;

import com.interviewPlatform.dtos.request.LoginRequest;
import com.interviewPlatform.dtos.request.RegisterRequest;
import com.interviewPlatform.dtos.response.AuthResponse;
import com.interviewPlatform.entities.BlacklistedToken;
import com.interviewPlatform.entities.User;
import com.interviewPlatform.repositories.BlackListedTokenRepository;
import com.interviewPlatform.services.UserService;
import com.interviewPlatform.services.Impl.JWTService;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;

@RestController

@RequiredArgsConstructor
public class AuthController {
   
    private final UserService userService;
    private final JWTService jwtService;
    private final BlackListedTokenRepository blackListedTokenRepository;


    @PostMapping("/register")
    public ResponseEntity<String> register(@RequestBody RegisterRequest request){
        userService.registerUser(request);
        return ResponseEntity.ok("User registered successfully");

    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            AuthResponse response = userService.verify(request);
            return ResponseEntity.ok(response);
        } catch (AuthenticationException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid email or password."));
        } catch (RuntimeException e) {
            String msg = e.getMessage();
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", msg != null && !msg.isBlank() ? msg : "Login failed."));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@RequestBody Map<String, String> request) {
        String refreshToken = request.get("refreshToken");

        try {
            String email = jwtService.extractUserName(refreshToken);

            //  1. Check token type
            if (!jwtService.isRefreshToken(refreshToken)) {
                return ResponseEntity.status(401).body(null);
            }

            // 2.Check expiry
            if (jwtService.isTokenExpired(refreshToken)) {
                return ResponseEntity.status(401)
                        .body(null);
            }

            // 3.Generate new access token
            String newAccessToken = jwtService.generateAccessToken(email);

            //4. Fetch user
            User user = userService.findByEmail(email);

            AuthResponse response = new AuthResponse(
                    newAccessToken,
                    refreshToken, // reuse same refresh token
                    email,
                    user.getRole().name()
            );

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(401).body(null);
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<String> logout(HttpServletRequest request){
        String authHeader=request.getHeader("Authorization");

        if(authHeader != null && authHeader.startsWith("Bearer ")){
            String token=authHeader.substring(7);

            BlacklistedToken blacklistedToken=new BlacklistedToken();
            blacklistedToken.setToken(token);
            blacklistedToken.setExpiryDate(jwtService.extractExpiration(token));

            blackListedTokenRepository.save(blacklistedToken);

            return ResponseEntity.ok("Logged out successfully");
        }

        return ResponseEntity.badRequest().body("No Token Found");
    }

}
