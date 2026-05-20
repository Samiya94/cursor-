package com.interviewPlatform.controllers;

import java.util.Date;
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
import com.interviewPlatform.entities.RefreshToken;
import com.interviewPlatform.entities.User;
import com.interviewPlatform.repositories.BlackListedTokenRepository;
import com.interviewPlatform.repositories.RefreshTokenRepository;
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
    private final RefreshTokenRepository refreshTokenRepository;


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
            // 1. Validate token type
            if (!jwtService.isRefreshToken(refreshToken)) {
                return ResponseEntity.status(401).body(null);
            }

            // 2. Check expiry
            if (jwtService.isTokenExpired(refreshToken)) {
                return ResponseEntity.status(401).body(null);
            }

            // 3. Validate refresh token exists in DB (prevents use of old/invalidated refresh tokens)
            boolean tokenExistsInDb = refreshTokenRepository.findByToken(refreshToken).isPresent();
            if (!tokenExistsInDb) {
                return ResponseEntity.status(401).body(null);
            }

            String email = jwtService.extractUserName(refreshToken);

            // 4. Generate new access token
            String newAccessToken = jwtService.generateAccessToken(email);

            // 5. Rotate the refresh token — generate a new one, replace old in DB
            //    This keeps the session alive across page refreshes without requiring re-login.
            String newRefreshToken = jwtService.generateRefreshToken(email);

            // Delete old refresh token and save new one
            refreshTokenRepository.deleteByUsername(email);
            RefreshToken newStoredToken = new RefreshToken();
            newStoredToken.setToken(newRefreshToken);
            newStoredToken.setUsername(email);
            newStoredToken.setExpiryDate(new Date(System.currentTimeMillis() + 1000L * 60 * 60 * 24 * 7));
            refreshTokenRepository.save(newStoredToken);

            // 6. Fetch user for role
            User user = userService.findByEmail(email);

            AuthResponse response = new AuthResponse(
                    newAccessToken,
                    newRefreshToken, // send NEW refresh token to client
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
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);

            // Blacklist the access token
            BlacklistedToken blacklistedToken = new BlacklistedToken();
            blacklistedToken.setToken(token);
            blacklistedToken.setExpiryDate(jwtService.extractExpiration(token));
            blackListedTokenRepository.save(blacklistedToken);

            // Also delete refresh token from DB so it can't be used to get new access tokens
            try {
                String email = jwtService.extractUserName(token);
                refreshTokenRepository.deleteByUsername(email);
            } catch (Exception ignored) {
                // token may already be expired; still proceed with blacklisting
            }

            return ResponseEntity.ok("Logged out successfully");
        }

        return ResponseEntity.badRequest().body("No Token Found");
    }
}