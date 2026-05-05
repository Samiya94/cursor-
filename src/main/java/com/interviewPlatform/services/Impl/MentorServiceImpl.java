package com.interviewPlatform.services.Impl;

import java.time.LocalDateTime;
import java.util.List;


import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.interviewPlatform.dtos.request.MentorRegisterRequest;
import com.interviewPlatform.dtos.response.MentorResponse;
import com.interviewPlatform.entities.Department;
import com.interviewPlatform.entities.Institute;
import com.interviewPlatform.entities.Mentor;
import com.interviewPlatform.entities.User;
import com.interviewPlatform.enums.Role;
import com.interviewPlatform.enums.Status;
import com.interviewPlatform.repositories.DepartmentRepository;
import com.interviewPlatform.repositories.InstituteRepository;
import com.interviewPlatform.repositories.MentorRepository;
import com.interviewPlatform.repositories.UserRepository;
import com.interviewPlatform.services.InstituteService;
import com.interviewPlatform.services.MentorService;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MentorServiceImpl implements MentorService {

    private final MentorRepository mentorRepository;
    private final InstituteRepository instituteRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final InstituteService instituteService;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    @Override
    public void registerMentor(MentorRegisterRequest request) {
       // 1. Validate Token
        boolean valid = instituteService.validateRegistrationToken(
                request.instituteId(),
                request.token()
        );

        if (!valid) {
            throw new RuntimeException("Invalid or expired registration link");
        }

        // 2. Password Match
        if (!request.password().equals(request.confirmPassword())) {
            throw new RuntimeException("Passwords do not match");
        }

        // 3. Fetch Institute
    Institute institute = instituteRepository.findById(request.instituteId())
            .orElseThrow(() -> new RuntimeException("Institute not found"));

            // 4. Fetch Department 
    Department department = departmentRepository.findById(request.departmentId())
            .orElseThrow(() -> new RuntimeException("Department not found"));

            // 5. Validate Department belongs to Institute 
    if (!department.getInstitute().getId().equals(institute.getId())) {
        throw new RuntimeException("Department does not belong to this institute");
    }

    // 6. Check if mentor already exists 
    if (mentorRepository.existsByDepartment(department)) {
        throw new RuntimeException("Mentor already exists for this department");
    }


        // 7. Create USER
        User user = new User();
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(Role.MENTOR);
        user.setStatus(Status.ACTIVE);

        User savedUser = userRepository.save(user);


        // 8. Create Mentor
        Mentor mentor = new Mentor();
        mentor.setUser(savedUser);
        mentor.setFirstName(request.firstName());
        mentor.setLastName(request.lastName());
        mentor.setPhone(request.phone());
       
        mentor.setDesignation(request.designation());
        mentor.setInstitute(institute);
        mentor.setDepartment(department);

        mentorRepository.save(mentor);
    }

    @Override
    public List<MentorResponse> getMentorsByInstitute(Long instituteId) {
        List<Mentor> mentors = mentorRepository.findByInstituteId(instituteId);

        return mentors.stream().map(m -> new MentorResponse(
                m.getDepartment().getId(),
                m.getDepartment().getName(),
                m.getFirstName() + " " + m.getLastName(),
                m.getUser().getEmail(),
                m.getPhone(),
                m.getDesignation()
        )).toList();
    }
}
