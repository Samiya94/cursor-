package com.interviewPlatform.services;

import com.interviewPlatform.dtos.request.InterviewerRegisterRequest;

public interface InterviewerService {
String registerInterviewer(InterviewerRegisterRequest dto);
}
