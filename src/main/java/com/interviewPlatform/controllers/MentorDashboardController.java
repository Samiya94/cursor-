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
import com.interviewPlatform.services.StudentFeedbackService;
import com.interviewPlatform.dtos.response.StudentFeedbackReportDTO;

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
    private final StudentFeedbackService feedbackService;

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
            .map(s -> {
                String resumeFileName = s.getResumeUrl();
                String resumeUrl = (resumeFileName != null && !resumeFileName.isBlank())
                    ? "/uploads/" + resumeFileName
                    : null;
                return new StudentProfileResponseDTO(
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
                    s.getDepartment() != null ? s.getDepartment().getName() : null,
                    resumeFileName,
                    resumeUrl,
                    null,  // projectName
                    null,  // projectBrief
                    null,   // projectGithub
                    applicationRepository.findByStudentId(s.getId()).stream()
                        .filter(a -> a.getStatus() == Status.APPROVED && 
                                     a.getInterviewRequest() != null && 
                                     a.getInterviewRequest().getStatus() == Status.COMPLETED)
                        .count()
                );
            })
            .toList();

        return ResponseEntity.ok(dtos);
    }

    // Mentor sees students who have applied for upcoming interviews in their institute
    @PreAuthorize("hasRole('MENTOR')")
    @GetMapping("/upcoming-students")
    public ResponseEntity<?> getUpcomingStudents(Authentication auth) {
        Mentor mentor = mentorRepository.findByUserEmail(auth.getName())
            .orElseThrow(() -> new RuntimeException("Mentor not found"));

        Long instituteId = mentor.getInstitute().getId();

        // Get all confirmed/rescheduled interview requests for this institute
        List<com.interviewPlatform.entities.InterviewRequest> upcomingRequests =
            interviewRequestRepository.findByInstituteIdAndStatusIn(
                instituteId,
                List.of(Status.CONFIRMED, Status.RESCHEDULED, Status.PENDING)
            );

        // For each request, get the applicants and build a flat row per student
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (com.interviewPlatform.entities.InterviewRequest req : upcomingRequests) {
            List<com.interviewPlatform.entities.StudentApplication> applications =
                applicationRepository.findByInterviewRequestId(req.getId());

            for (com.interviewPlatform.entities.StudentApplication app : applications) {
                com.interviewPlatform.entities.Student s = app.getStudent();
                Map<String, Object> row = new HashMap<>();
                // Student fields
                row.put("studentId", s.getId());
                row.put("firstName", s.getFirstName());
                row.put("lastName", s.getLastName());
                row.put("email", s.getUser().getEmail());
                row.put("phone", s.getPhone());
                row.put("studentClass", s.getStudentClass());
                row.put("cgpa", s.getCgpa());
                row.put("skills", s.getSkills());
                String resumeFileName = s.getResumeUrl();
                row.put("resumeFileName", resumeFileName);
                row.put("resumeUrl", (resumeFileName != null && !resumeFileName.isBlank())
                    ? "/uploads/" + resumeFileName
                    : null);
                // Application fields
                row.put("applicationId", app.getId());
                row.put("applicationStatus", app.getStatus() != null ? app.getStatus().name() : "PENDING");
                row.put("appliedAt", app.getAppliedAt());
                // Interview request fields
                row.put("interviewId", req.getId());
                row.put("departmentName", req.getDepartmentName());
                row.put("scheduledDate", req.getScheduledDate());
                row.put("scheduledVenue", req.getScheduledVenue());
                row.put("expertise", req.getExpertise());
                row.put("interviewStatus", req.getStatus().name());
                result.add(row);
            }
        }

        return ResponseEntity.ok(result);
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

    // Mentor sees student feedback reports
    @PreAuthorize("hasRole('MENTOR')")
    @GetMapping("/students/{studentId}/feedback-reports")
    public ResponseEntity<List<StudentFeedbackReportDTO>> getStudentFeedbackReports(@PathVariable Long studentId) {
        return ResponseEntity.ok(feedbackService.getFeedbackReportsByStudentId(studentId));
    }
}