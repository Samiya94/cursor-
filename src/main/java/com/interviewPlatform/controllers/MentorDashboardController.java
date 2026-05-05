package com.interviewPlatform.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import com.interviewPlatform.dtos.response.MentorProfileResponseDTO;
import com.interviewPlatform.dtos.response.StudentProfileResponseDTO;
import com.interviewPlatform.repositories.InterviewRequestRepository;
import com.interviewPlatform.repositories.MentorRepository;
import com.interviewPlatform.repositories.StudentApplicationRepository;
import com.interviewPlatform.repositories.StudentRepository;
import com.interviewPlatform.entities.Mentor;
import com.interviewPlatform.entities.Student;
import com.interviewPlatform.enums.Status;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/mentor")
@RequiredArgsConstructor
public class MentorDashboardController {

    private final MentorRepository mentorRepository;
    private final StudentRepository studentRepository;
    private final InterviewRequestRepository interviewRequestRepository;
    private final StudentApplicationRepository applicationRepository;

    @PreAuthorize("hasRole('MENTOR')")
    @GetMapping("/me")
    public ResponseEntity<MentorProfileResponseDTO> getMyProfile(Authentication auth) {

        Mentor mentor = mentorRepository.findByUserEmail(auth.getName())
            .orElseThrow(() -> new RuntimeException("Mentor not found"));

        MentorProfileResponseDTO dto = new MentorProfileResponseDTO(
            mentor.getId(),
            mentor.getFirstName(),
            mentor.getLastName(),
            mentor.getUser().getEmail(),
            mentor.getPhone(),
            mentor.getDesignation(),
            mentor.getDepartment() != null ? mentor.getDepartment().getId() : null,
            mentor.getDepartment() != null ? mentor.getDepartment().getName() : null,
            mentor.getInstitute() != null ? mentor.getInstitute().getId() : null,
            mentor.getInstitute() != null ? mentor.getInstitute().getInstituteName() : null
        );

        return ResponseEntity.ok(dto);
    }

    @PreAuthorize("hasRole('MENTOR')")
    @GetMapping("/students")
    public ResponseEntity<List<StudentProfileResponseDTO>> getMyStudents(Authentication auth) {

        Mentor mentor = mentorRepository.findByUserEmail(auth.getName())
            .orElseThrow(() -> new RuntimeException("Mentor not found"));

        List<Student> students = studentRepository
            .findByDepartmentId(mentor.getDepartment().getId());

        List<StudentProfileResponseDTO> dtos = students.stream()
            .map(s -> new StudentProfileResponseDTO(
                s.getId(),
                s.getFirstName(),
                s.getLastName(),
                s.getUser().getEmail(),
                s.getPhone(),
                s.getStudentClass(),
                s.getCgpa(),
                s.getAbout(),
                s.getSkills(),
                s.getInstitute() != null ? s.getInstitute().getId() : null,
                s.getInstitute() != null ? s.getInstitute().getInstituteName() : null,
                s.getDepartment() != null ? s.getDepartment().getId() : null,
                s.getDepartment() != null ? s.getDepartment().getName() : null
            ))
            .toList();

        return ResponseEntity.ok(dtos);
    }

    // Mentor sees confirmed/rescheduled interviews for their institute + applicant counts
@PreAuthorize("hasRole('MENTOR')")
@GetMapping("/interviews")
public ResponseEntity<?> getScheduledInterviews(Authentication auth) {
    Mentor mentor = mentorRepository.findByUserEmail(auth.getName())
        .orElseThrow(() -> new RuntimeException("Mentor not found"));

    List<Map<String, Object>> result =
        interviewRequestRepository.findByInstituteId(mentor.getInstitute().getId())
        .stream()
        .filter(r -> r.getStatus() == Status.CONFIRMED || r.getStatus() == Status.RESCHEDULED)
        .map(r -> {
            long count = applicationRepository.countByInterviewRequestId(r.getId());
            Map<String, Object> m = new HashMap<>();
            m.put("id", r.getId());
            m.put("departmentName", r.getDepartmentName());
            m.put("scheduledDate", r.getScheduledDate());
            m.put("scheduledVenue", r.getScheduledVenue());
            m.put("meetingLink", r.getMeetingLink());
            m.put("status", r.getStatus().name());
            m.put("applicantCount", count);
            return m;
        }).toList();

    return ResponseEntity.ok(result);
}
}