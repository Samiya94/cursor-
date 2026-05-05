package com.interviewPlatform.services;

import com.interviewPlatform.dtos.request.InstituteRegisterRequest;
import com.interviewPlatform.dtos.request.InterviewerRegisterRequest;

public interface AuthService {
    void registerInstitute(InstituteRegisterRequest request);
    void registerInterviewer(InterviewerRegisterRequest request);

}
