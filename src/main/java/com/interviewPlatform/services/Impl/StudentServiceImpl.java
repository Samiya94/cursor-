package com.interviewPlatform.services.Impl;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.interviewPlatform.dtos.request.StudentProfileUpdateRequestDTO;
import com.interviewPlatform.dtos.request.StudentRegisterRequestDTO;
import com.interviewPlatform.dtos.response.StudentProfileResponseDTO;
import com.interviewPlatform.dtos.response.StudentResumeResponseDTO;
import com.interviewPlatform.entities.Department;
import com.interviewPlatform.entities.Institute;
import com.interviewPlatform.entities.Student;
import com.interviewPlatform.entities.User;
import com.interviewPlatform.enums.Role;
import com.interviewPlatform.enums.Status;
import com.interviewPlatform.repositories.DepartmentRepository;
import com.interviewPlatform.repositories.InstituteRepository;
import com.interviewPlatform.repositories.StudentRepository;
import com.interviewPlatform.repositories.UserRepository;
import com.interviewPlatform.services.InstituteService;
import com.interviewPlatform.services.StudentService;
import com.interviewPlatform.dtos.request.ChangePasswordRequestDTO;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class StudentServiceImpl implements StudentService {
    private final StudentRepository studentRepository;
    private final UserRepository userRepository;
    private final InstituteRepository instituteRepository;
    private final DepartmentRepository departmentRepository;
    private final InstituteService instituteService;
    private final PasswordEncoder passwordEncoder;
    private final com.interviewPlatform.repositories.StudentApplicationRepository applicationRepository;

    @Override
    @Transactional
    public void registerStudent(StudentRegisterRequestDTO request) {
        if (request == null) {
            throw new RuntimeException("Request is required");
        }

        boolean validToken = instituteService.validateRegistrationToken(request.instituteId(), request.token());
        if (!validToken) {
            throw new RuntimeException("Invalid or expired registration link");
        }

        if (request.password() == null || !request.password().equals(request.confirmPassword())) {
            throw new RuntimeException("Passwords do not match");
        }

        if (userRepository.existsByEmail(request.email())) {
            throw new RuntimeException("Email already exists");
        }

        Institute institute = instituteRepository.findById(request.instituteId())
                .orElseThrow(() -> new RuntimeException("Institute not found"));
        Department department = departmentRepository.findById(request.departmentId())
                .orElseThrow(() -> new RuntimeException("Department not found"));

        if (!department.getInstitute().getId().equals(institute.getId())) {
            throw new RuntimeException("Department does not belong to this institute");
        }

        User user = new User();
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(Role.STUDENT);
        user.setStatus(Status.ACTIVE);
        User savedUser = userRepository.save(user);

        Student student = new Student();
        student.setUser(savedUser);
        student.setInstitute(institute);
        student.setDepartment(department);
        student.setFirstName(request.firstName());
        student.setLastName(request.lastName());
        student.setPhone(request.phone());
        student.setStudentClass(request.studentClass());

        studentRepository.save(student);
    }

    @Override
    public StudentProfileResponseDTO getMyProfile(String email) {
        Student student = getStudentByEmail(email);
        return mapToResponse(student);
    }

    @Override
    @Transactional
    public StudentProfileResponseDTO updateMyProfile(String email, StudentProfileUpdateRequestDTO request) {
        Student student = getStudentByEmail(email);
        if (request.studentClass() != null) {
            student.setStudentClass(request.studentClass());
        }
        if (request.cgpa() != null) {
            student.setCgpa(request.cgpa());
        }
        if (request.about() != null) {
            student.setAbout(request.about());
        }
        if (request.skills() != null) {
            student.setSkills(request.skills());
        }
        if (request.projectName() != null) {
            student.setProjectName(request.projectName());
        }
        if (request.projectBrief() != null) {
            student.setProjectBrief(request.projectBrief());
        }
        if (request.projectGithub() != null) {
            student.setProjectGithub(request.projectGithub());
        }
        return mapToResponse(studentRepository.save(student));
    }

    @Override
    @Transactional
    public void changePassword(String email, ChangePasswordRequestDTO request) {
        Student student = getStudentByEmail(email);
        User user = student.getUser();

        if (request.newPassword() == null || request.newPassword().length() < 6) {
            throw new RuntimeException("New password must be at least 6 characters");
        }
        if (!request.newPassword().equals(request.confirmPassword())) {
            throw new RuntimeException("Passwords do not match");
        }
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new RuntimeException("Current password is incorrect");
        }

        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
    }

    private Student getStudentByEmail(String email) {
        return studentRepository.findByUserEmail(email)
                .orElseThrow(() -> new RuntimeException("Student not found"));
    }

    private StudentProfileResponseDTO mapToResponse(Student student) {
        String resumeFileName = student.getResumeUrl();
        String resumeUrl = (resumeFileName != null && !resumeFileName.isBlank())
            ? "/uploads/" + resumeFileName
            : null;
        return new StudentProfileResponseDTO(
                student.getId(),
                student.getFirstName(),
                student.getLastName(),
                student.getUser().getEmail(),
                student.getPhone(),
                student.getStudentClass(),
                student.getCgpa(),
                student.getAbout(),
                student.getSkills(),
                student.getInstitute() != null ? student.getInstitute().getId() : null,
                student.getInstitute() != null ? student.getInstitute().getInstituteName() : null,
                student.getDepartment() != null ? student.getDepartment().getId() : null,
                student.getDepartment() != null ? student.getDepartment().getName() : null,
                resumeFileName,
                resumeUrl,
                student.getProjectName(),
                student.getProjectBrief(),
                student.getProjectGithub(),
                applicationRepository.findByStudentId(student.getId()).stream()
                    .filter(a -> a.getStatus() == Status.APPROVED && 
                                 a.getInterviewRequest() != null && 
                                 a.getInterviewRequest().getStatus() == Status.COMPLETED)
                    .count()
        );
    }

    @Override
    public StudentResumeResponseDTO getMyResume(String email) {
        Student student = getStudentByEmail(email);
        String fileName = student.getResumeUrl();
        if (fileName == null || fileName.isBlank()) {
            return new StudentResumeResponseDTO(
                student.getId(),
                null,
                null,
                null
            );
        }

        // Resume is stored under /uploads/<fileName>. We embed a timestamp prefix on upload.
        java.time.LocalDateTime uploadedAt = null;
        try {
            int idx = fileName.indexOf('_');
            if (idx > 0) {
                long millis = Long.parseLong(fileName.substring(0, idx));
                uploadedAt = java.time.LocalDateTime.ofInstant(
                    java.time.Instant.ofEpochMilli(millis),
                    java.time.ZoneId.systemDefault()
                );
            }
        } catch (Exception ignored) {}

        return new StudentResumeResponseDTO(
            student.getId(),
            fileName,
            uploadedAt,
            "/uploads/" + fileName
        );
    }

    @Override
public StudentResumeResponseDTO uploadMyResume(String email, MultipartFile resumeFile) {
    Student student = getStudentByEmail(email);
    if (resumeFile == null || resumeFile.isEmpty()) {
        throw new RuntimeException("Resume file is required");
    }

    String original = resumeFile.getOriginalFilename();
    if (original == null || original.isBlank()) original = "resume.pdf";
    // Sanitize filename: remove path separators and unsafe characters
    original = original.replaceAll("[/\\\\:*?\"<>|]", "_").trim();

    String fileName = System.currentTimeMillis() + "_" + original;

    try {
        var uploadsDir = java.nio.file.Paths.get("uploads");
        java.nio.file.Files.createDirectories(uploadsDir);
        var target = uploadsDir.resolve(fileName);
        java.nio.file.Files.write(target, resumeFile.getBytes());

        student.setResumeUrl(fileName);
        studentRepository.save(student);

        return new StudentResumeResponseDTO(
            student.getId(),
            fileName,
            java.time.LocalDateTime.now(),
            "/uploads/" + fileName
        );
    } catch (Exception e) {
        throw new RuntimeException("Resume upload failed");
    }
}
}
