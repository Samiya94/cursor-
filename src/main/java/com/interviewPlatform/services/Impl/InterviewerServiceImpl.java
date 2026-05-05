package com.interviewPlatform.services.Impl;

import org.springframework.stereotype.Service;

import com.interviewPlatform.dtos.request.InterviewerRegisterRequest;
import com.interviewPlatform.services.AuthService;
import com.interviewPlatform.services.InterviewerService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class InterviewerServiceImpl implements InterviewerService {
    private final AuthService authService;

    @Override
    public String registerInterviewer(InterviewerRegisterRequest dto) {
        authService.registerInterviewer(dto);
        return "Interviewer Registered Successfully";
    }
}
