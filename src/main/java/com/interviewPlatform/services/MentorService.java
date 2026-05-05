package com.interviewPlatform.services;

import java.util.List;

import com.interviewPlatform.dtos.request.MentorRegisterRequest;
import com.interviewPlatform.dtos.response.MentorResponse;

public interface MentorService {
    void registerMentor(MentorRegisterRequest request);
    List<MentorResponse> getMentorsByInstitute(Long instituteId);
}
