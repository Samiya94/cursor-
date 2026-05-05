package com.interviewPlatform.services.Impl;

import java.time.LocalDateTime;


import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.interviewPlatform.dtos.request.InstituteRegisterRequest;
import com.interviewPlatform.dtos.response.InstituteResponseDTO;
import com.interviewPlatform.entities.Institute;
import com.interviewPlatform.entities.User;
import com.interviewPlatform.enums.Role;
import com.interviewPlatform.enums.Status;
import com.interviewPlatform.repositories.InstituteRepository;
import com.interviewPlatform.repositories.UserRepository;
import com.interviewPlatform.services.InstituteService;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class InstituteServiceImpl implements InstituteService {
    private final UserRepository userRepository;
    private final InstituteRepository instituteRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    @Override
    public void registerInstitute(InstituteRegisterRequest dto) {

        // 1. Password match check
        if (!dto.password().equals(dto.confirmPassword())) {
            throw new RuntimeException("Passwords do not match");
        }

        // 2. Email already exists check
        if (userRepository.findByEmail(dto.email()).isPresent()) {
            throw new RuntimeException("Email already registered");
        }
        if (instituteRepository.existsByInstituteCode(dto.instituteCode())) {
    throw new RuntimeException("Institute code already exists");
}

        // 3. Create User (TPO/Admin)
        User user = new User();
        // user.setName(dto.adminName());
        user.setEmail(dto.email());
        // user.setPhone(dto.contactNumber());

        user.setPassword(passwordEncoder.encode(dto.password()));

        user.setRole(Role.INSTITUTE);
        user.setStatus(Status.ACTIVE);

        // SAVE USER FIRST
        User savedUser =userRepository.save(user);

        // 4. Create Institute
        Institute institute = new Institute();
        institute.setInstituteName(dto.instituteName());
        institute.setUniversity(dto.university());
        institute.setInstituteCode(dto.instituteCode());
        institute.setAddress(dto.address());
        institute.setCity(dto.city());
        institute.setState(dto.state());
        institute.setWebsite(dto.website());
        institute.setStudentStrength(dto.studentStrength());

        // LINK USER → INSTITUTE
        institute.setUser(savedUser);

        // SAVE INSTITUTE
        instituteRepository.save(institute);
        
    }
    
    @Override
public String getOrCreateRegistrationLink(Long instituteId) {

    Institute institute = instituteRepository.findById(instituteId)
        .orElseThrow(() -> new RuntimeException("Institute not found"));

   
    String token = "REG-" + java.util.UUID.randomUUID()
            .toString()
            .substring(0, 8)
            .toUpperCase();

    institute.setRegistrationToken(token);
    institute.setTokenCreatedAt(java.time.LocalDateTime.now());

    instituteRepository.save(institute);

    return "http://localhost:8080/register/mentor?inst="
            + instituteId + "&token=" + token;
}

    @Override
public boolean validateRegistrationToken(Long instituteId, String token) {

    Institute institute = instituteRepository.findById(instituteId)
        .orElseThrow(() -> new RuntimeException("Institute not found"));

    if (!token.equals(institute.getRegistrationToken())) {
        return false;
    }

    // Expiry check (24 hours)
    if (institute.getTokenCreatedAt() == null ||
        institute.getTokenCreatedAt().plusHours(24).isBefore(LocalDateTime.now())) {
        throw new RuntimeException("Token expired");
    }

    return true;
}

    @Override
    public InstituteResponseDTO getInstituteById(Long id) {
        Institute institute= instituteRepository.findById(id).orElseThrow(() -> new RuntimeException("Institute Not Found"));
        return new InstituteResponseDTO(
            institute.getId(),
            institute.getInstituteName(),
            institute.getCity()
        );
    }

    @Override
    public Institute getInstituteByEmail(String email) {
        return instituteRepository.findByUserEmail(email).orElseThrow(()-> new RuntimeException("Institute Not Found"));
    }

    @Override
    public String getStudentRegistrationLink(Long instituteId, Long deptId) {
        Institute institute = instituteRepository.findById(instituteId)
        .orElseThrow(() -> new RuntimeException("Institute not found"));

    // Reuse the same token that already exists on the institute
    // (created when mentor link was generated)
    // If no token exists yet, create one now
    if (institute.getRegistrationToken() == null) {
        String token = "REG-" + java.util.UUID.randomUUID()
                .toString()
                .substring(0, 8)
                .toUpperCase();
        institute.setRegistrationToken(token);
        institute.setTokenCreatedAt(java.time.LocalDateTime.now());
        instituteRepository.save(institute);
    }

    return "http://localhost:8080/register/student"
            + "?instituteId=" + instituteId
            + "&dept=" + deptId
            + "&token=" + institute.getRegistrationToken();
    }

}
