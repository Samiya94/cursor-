package com.interviewPlatform.services.Impl;

import java.util.Date;


import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.interviewPlatform.dtos.request.LoginRequest;
import com.interviewPlatform.dtos.request.RegisterRequest;
import com.interviewPlatform.dtos.response.AuthResponse;
import com.interviewPlatform.dtos.response.RegisterResponse;
import com.interviewPlatform.entities.RefreshToken;
import com.interviewPlatform.entities.User;
import com.interviewPlatform.enums.Role;
import com.interviewPlatform.enums.Status;
import com.interviewPlatform.repositories.RefreshTokenRepository;
import com.interviewPlatform.repositories.UserRepository;
import com.interviewPlatform.services.UserService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authManager;
    private final JWTService jwtService;
    private final  UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;

    

    @Override
    public RegisterResponse registerUser(RegisterRequest request) {
        // check duplicate email
        if (userRepository.existsByEmail(request.email())) {
            throw new RuntimeException("Email already exists");
        }

        User user=new User();
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(request.role());
        user.setStatus(Status.ACTIVE);

       User savedUser= userRepository.save(user);

        return new RegisterResponse(
            savedUser.getId(),
            savedUser.getEmail(),
            savedUser.getRole()
        );

    }



    @Override
    @Transactional
    public AuthResponse verify(LoginRequest request) {
        //Authenticate User
        Authentication authentication=authManager.authenticate(new UsernamePasswordAuthenticationToken(request.email(), request.password()));

        if(authentication.isAuthenticated()){
            //Generate both tokens
        String accessToken = jwtService.generateAccessToken(request.email());
        String refreshToken = jwtService.generateRefreshToken(request.email());

             //Fetch role from DB
        User dbUser = userRepository.findByEmail(request.email()).orElseThrow(() -> new RuntimeException("User not found"));

        // Block pending/rejected interviewers from logging in
        if (dbUser.getRole() == Role.INTERVIEWER) {
            if (dbUser.getStatus() == Status.PENDING) {
                throw new RuntimeException("Your account is under review. Please wait for admin approval.");
            }
            if (dbUser.getStatus() == Status.INACTIVE) {
                throw new RuntimeException("Your registration was not approved by admin.");
            }
        }


        //Delete old token first
        refreshTokenRepository.deleteByUsername(dbUser.getEmail());

        //save refresh token in DB
        RefreshToken token=new RefreshToken();
        token.setToken(refreshToken);
        token.setUsername(dbUser.getEmail());
        token.setExpiryDate(new Date(System.currentTimeMillis() + 1000 * 60 * 60 * 24 * 7));

        refreshTokenRepository.save(token);

        return new AuthResponse(
            accessToken,
            refreshToken,
            dbUser.getEmail(),
            dbUser.getRole().name()
        );
        }
            

        throw new RuntimeException("Invalid credentials");
    }



    @Override
    public User findByEmail(String email) {
    return userRepository.findByEmail(email)
        .orElseThrow(() -> new RuntimeException("User not found"));
}
}
