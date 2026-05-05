package com.interviewPlatform.services;

import com.interviewPlatform.dtos.request.StudentProfileUpdateRequestDTO;
import com.interviewPlatform.dtos.request.ChangePasswordRequestDTO;
import com.interviewPlatform.dtos.request.StudentRegisterRequestDTO;
import org.springframework.web.multipart.MultipartFile;
import com.interviewPlatform.dtos.response.StudentResumeResponseDTO;
import com.interviewPlatform.dtos.response.StudentProfileResponseDTO;

public interface StudentService {
    void registerStudent(StudentRegisterRequestDTO request);

    StudentProfileResponseDTO getMyProfile(String email);

    StudentProfileResponseDTO updateMyProfile(String email, StudentProfileUpdateRequestDTO request);

    void changePassword(String email, ChangePasswordRequestDTO request);

    StudentResumeResponseDTO getMyResume(String email);

    StudentResumeResponseDTO uploadMyResume(String email, MultipartFile resumeFile);
}
