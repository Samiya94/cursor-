package com.interviewPlatform.services;



import com.interviewPlatform.dtos.request.InstituteRegisterRequest;
import com.interviewPlatform.dtos.response.InstituteResponseDTO;
import com.interviewPlatform.entities.Institute;


public interface InstituteService {
    void registerInstitute(InstituteRegisterRequest dto);
    String getOrCreateRegistrationLink(Long instituteId);
    String getStudentRegistrationLink(Long instituteId, Long deptId);
    boolean validateRegistrationToken(Long instituteId, String token);
    InstituteResponseDTO getInstituteById(Long id);
    Institute getInstituteByEmail(String email);
}
