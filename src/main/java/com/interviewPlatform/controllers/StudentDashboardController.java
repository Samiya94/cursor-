package com.interviewPlatform.controllers;

import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.interviewPlatform.dtos.response.StudentDashboardStatsDTO;
import com.interviewPlatform.entities.InterviewRequest;
import com.interviewPlatform.entities.StudentApplication;
import com.interviewPlatform.entities.Student;
import com.interviewPlatform.enums.Status;
import com.interviewPlatform.repositories.InterviewEvaluationRepository;
import com.interviewPlatform.repositories.InterviewRequestRepository;
import com.interviewPlatform.repositories.StudentApplicationRepository;
import com.interviewPlatform.repositories.StudentRepository;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/student")
@RequiredArgsConstructor
public class StudentDashboardController {

    private final StudentRepository studentRepository;
    private final InterviewRequestRepository interviewRequestRepository;
    private final StudentApplicationRepository applicationRepository;
    private final InterviewEvaluationRepository evaluationRepository;

    private static final DateTimeFormatter DISPLAY_FMT =
        DateTimeFormatter.ofPattern("MMM dd, yyyy · hh:mm a");

    @PreAuthorize("hasRole('STUDENT')")
    @GetMapping("/dashboard-stats")
    public ResponseEntity<StudentDashboardStatsDTO> getDashboardStats(Authentication auth) {

        Student student = studentRepository.findByUserEmail(auth.getName())
            .orElseThrow(() -> new RuntimeException("Student not found"));

        List<StudentApplication> myApplications =
            applicationRepository.findByStudentId(student.getId());

        // interviewsTaken = interviews the student has actually completed
        long interviewsTaken = myApplications.stream()
            .filter(a -> a.getStatus() == Status.APPROVED && 
                         a.getInterviewRequest() != null && 
                         a.getInterviewRequest().getStatus() == Status.COMPLETED)
            .count();

        long pendingCount = 0; // no more pending — all are auto-approved now

        long confirmedCount = interviewsTaken;

        List<Double> evalScores = myApplications.stream()
            .map(a -> evaluationRepository.findByApplicationId(a.getId()).orElse(null))
            .filter(java.util.Objects::nonNull)
            .map(e -> e.getOverallScore())
            .filter(java.util.Objects::nonNull)
            .toList();
        Double averageScore = evalScores.isEmpty() ? 0.0
            : evalScores.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        Double bestScore = evalScores.isEmpty() ? 0.0
            : evalScores.stream().mapToDouble(Double::doubleValue).max().orElse(0.0);

        List<StudentDashboardStatsDTO.StudentInterviewItemDTO> interviewItems = myApplications.stream()
            .filter(a -> a.getStatus() == Status.APPROVED)
            .map(app -> {
                InterviewRequest req = app.getInterviewRequest();
                var scheduled = req.getScheduledDate() != null ? req.getScheduledDate() : req.getStartDate();
                var dateTime =
                    scheduled != null ? scheduled.format(DISPLAY_FMT) : "TBD";
                String interviewerName = app.getAssignedInterviewer() != null
                        ? app.getAssignedInterviewer().getFullName()
                        : (req.getAssignedInterviewer() != null ? req.getAssignedInterviewer().getFullName() : "");
                return new StudentDashboardStatsDTO.StudentInterviewItemDTO(
                    app.getId(),
                    req.getId(),
                    req.getDepartmentName() != null ? req.getDepartmentName() : "Interview",
                    req.getExpertise() != null ? String.join(", ", req.getExpertise()) : "",
                    dateTime,
                    app.getStatus() != null ? app.getStatus().name() : "APPROVED",
                    req.getContactPerson() != null ? req.getContactPerson() : "",
                    req.getRemarks() != null ? req.getRemarks() : "",
                    scheduled,
                    req.getMeetingLink() != null ? req.getMeetingLink() : "",
                    req.getScheduledVenue() != null ? req.getScheduledVenue() : "",
                    interviewerName
                );
            })
            .sorted((a, b) -> {
                if (a.scheduledDate() == null && b.scheduledDate() == null) return 0;
                if (a.scheduledDate() == null) return 1;
                if (b.scheduledDate() == null) return -1;
                return b.scheduledDate().compareTo(a.scheduledDate());
            })
            .collect(Collectors.toList());

        String resumeFileName = student.getResumeUrl();
        String resumeUrl = (resumeFileName != null && !resumeFileName.isBlank())
            ? "/uploads/" + resumeFileName : null;

        StudentDashboardStatsDTO stats = new StudentDashboardStatsDTO(
            interviewsTaken, pendingCount, confirmedCount,
            averageScore, bestScore,
            student.getFirstName(), student.getLastName(),
            student.getUser().getEmail(), student.getPhone(),
            student.getStudentClass(),
            student.getDepartment() != null ? student.getDepartment().getName() : "",
            student.getInstitute() != null ? student.getInstitute().getInstituteName() : "",
            student.getAbout(), student.getSkills(), student.getCgpa(),
            interviewItems,
            resumeFileName,
            resumeUrl,
            student.getProjectName(),
            student.getProjectBrief(),
            student.getProjectGithub()
        );

        return ResponseEntity.ok(stats);
    }

    // Students see interviews they can apply to (CONFIRMED or RESCHEDULED for their institute)
@PreAuthorize("hasRole('STUDENT')")
@GetMapping("/available-interviews")
public ResponseEntity<?> getAvailableInterviews(Authentication auth) {
    Student student = studentRepository.findByUserEmail(auth.getName())
        .orElseThrow(() -> new RuntimeException("Student not found"));

    List<com.interviewPlatform.entities.InterviewRequest> requests =
        interviewRequestRepository.findByInstituteIdAndStatusIn(
            student.getInstitute().getId(),
            List.of(
                Status.CONFIRMED,
                Status.RESCHEDULED,
                Status.AWAITING_CONFIRMATION
            )
        );

        // After finding requests, add this filter:
        String studentDeptName = student.getDepartment() != null ? student.getDepartment().getName() : null;
        if (studentDeptName != null) {
            requests = requests.stream()
                .filter(r -> studentDeptName.equalsIgnoreCase(r.getDepartmentName()))
                .toList();
        }

    List<Map<String, Object>> result = requests.stream().map(r -> {
        boolean applied = applicationRepository.existsByStudentIdAndInterviewRequestId(
            student.getId(), r.getId());
        Map<String, Object> m = new HashMap<>();
        m.put("id", r.getId());
        m.put("departmentName", r.getDepartmentName());
        m.put("expertise", r.getExpertise());
        m.put("scheduledDate", r.getScheduledDate());
        m.put("scheduledVenue", r.getScheduledVenue());
        m.put("meetingLink", r.getMeetingLink());
        m.put("status", r.getStatus().name());
        m.put("contactPerson", r.getContactPerson());
        m.put("alreadyApplied", applied);
        return m;
    }).toList();

    return ResponseEntity.ok(result);
}
}