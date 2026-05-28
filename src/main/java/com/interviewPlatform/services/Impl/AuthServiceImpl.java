package com.interviewPlatform.services.Impl;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;


import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.interviewPlatform.dtos.request.InstituteRegisterRequest;
import com.interviewPlatform.dtos.request.InterviewerRegisterRequest;
import com.interviewPlatform.entities.Institute;
import com.interviewPlatform.entities.Interviewer;
import com.interviewPlatform.entities.User;
import com.interviewPlatform.enums.Role;
import com.interviewPlatform.enums.Status;
import com.interviewPlatform.repositories.InstituteRepository;
import com.interviewPlatform.repositories.InterviewerRepository;
import com.interviewPlatform.repositories.UserRepository;
import com.interviewPlatform.services.AuthService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService{

    private final UserRepository userRepository;
    private final InstituteRepository instituteRepository;
    private final InterviewerRepository interviewerRepository;
    private final PasswordEncoder passwordEncoder;



    @Override
    @Transactional
    public void registerInstitute(InstituteRegisterRequest request) {
        // check duplicate
        if (userRepository.existsByEmail(request.email())) {
            throw new RuntimeException("Email already exists");
        }

        // password validation
        if (!request.password().equals(request.confirmPassword())) {
            throw new RuntimeException("Passwords do not match");
        }

        // create user
        User user = new User();
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(Role.INSTITUTE);
        user.setStatus(Status.ACTIVE);

       User savedUser= userRepository.save(user);

        // create institute
        Institute inst = new Institute();
        inst.setUser(savedUser);
        inst.setInstituteName(request.instituteName());
        inst.setUniversity(request.university());
        inst.setInstituteCode(request.instituteCode());
        inst.setAddress(request.address());
        inst.setCity(request.city());
        inst.setState(request.state());
        inst.setAdminName(request.adminName());
        inst.setDesignation(request.designation());
        inst.setContactNumber(request.contactNumber());
        inst.setWebsite(request.website());
        inst.setStudentStrength(request.studentStrength());

        instituteRepository.save(inst);
    }

    @Override
    @Transactional
    public void registerInterviewer(InterviewerRegisterRequest request) {
        if(userRepository.existsByEmail(request.email())){
            throw new RuntimeException("Email already exists");
        }

        if (!request.password().equals(request.confirmPassword())) {
            throw new RuntimeException("Passwords do not match");
        }

        // create user
        User user = new User();
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(Role.INTERVIEWER);
        user.setStatus(Status.PENDING);

        User savedUser=userRepository.save(user);

        // create interviewer
        Interviewer interviewer = new Interviewer();
        interviewer.setUser(savedUser);
        interviewer.setFullName(request.fullName());
        interviewer.setPhone(request.phone());
        interviewer.setLocation(request.location());
        interviewer.setJobTitle(request.jobTitle());
        interviewer.setCompany(request.company());
        interviewer.setExperience(request.experience());
        interviewer.setDomain(request.domain());
        interviewer.setQualification(request.qualification());
        interviewer.setLinkedin(request.linkedin());
        interviewer.setSkills(request.skills());
        interviewer.setInterviewExperience(request.interviewExperience());
        interviewer.setBio(request.bio());

        //5. Handle Image Upload
        try {
            if (request.profilePhoto() != null && !request.profilePhoto().isEmpty()) {

                String fileName = System.currentTimeMillis() + "_" +
                        request.profilePhoto().getOriginalFilename();

                Path path = Paths.get("uploads/profiles/" + fileName);
                Files.createDirectories(path.getParent());
                Files.write(path, request.profilePhoto().getBytes());

                interviewer.setProfilePhotoUrl("/uploads/profiles/" + fileName);
            }
        } catch (Exception e) {
            throw new RuntimeException("File upload failed");
        }

        //6. Handle Resume Upload
        try {
            if (request.resumeFile() != null && !request.resumeFile().isEmpty()) {
                String resumeFileName = System.currentTimeMillis() + "_resume_" +
                        request.resumeFile().getOriginalFilename();

                Path resumePath = Paths.get("uploads/resumes/" + resumeFileName);
                Files.createDirectories(resumePath.getParent());
                Files.write(resumePath, request.resumeFile().getBytes());

                interviewer.setResumeUrl("/uploads/resumes/" + resumeFileName);
            }
        } catch (Exception e) {
            throw new RuntimeException("Resume upload failed");
        }

        interviewerRepository.save(interviewer);
    }

}