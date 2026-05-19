package com.interviewPlatform.controllers;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.interviewPlatform.entities.Interviewer;
import com.interviewPlatform.entities.StudentApplication;
import com.interviewPlatform.repositories.InterviewRequestRepository;
import com.interviewPlatform.repositories.InterviewerRepository;
import com.interviewPlatform.repositories.StudentApplicationRepository;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/interviewer")
@RequiredArgsConstructor
public class InterviewerDashboardController {

    private final InterviewerRepository interviewerRepository;
    private final InterviewRequestRepository interviewRequestRepository;
    private final StudentApplicationRepository applicationRepository;

    // Interviewer sees interviews they are assigned to
    @PreAuthorize("hasRole('INTERVIEWER')")
    @GetMapping("/assigned-interviews")
    public ResponseEntity<?> getAssignedInterviews(Authentication auth) {
        Interviewer interviewer = interviewerRepository.findByUserEmail(auth.getName())
            .orElseThrow(() -> new RuntimeException("Interviewer not found"));

        List<Map<String, Object>> result =
        interviewRequestRepository.findAll().stream()
        .filter(r -> (r.getAssignedInterviewer() != null &&
                    r.getAssignedInterviewer().getId().equals(interviewer.getId()))
            || (r.getAssignedInterviewerIds() != null &&
                r.getAssignedInterviewerIds().contains(interviewer.getId())))
        .map(r -> {
            long count = applicationRepository.countByInterviewRequestId(r.getId());
            Map<String, Object> m = new HashMap<>();
            m.put("id", r.getId());
            m.put("departmentName", r.getDepartmentName());
            m.put("instituteName",
                r.getInstitute() != null ? r.getInstitute().getInstituteName() : "");
            m.put("scheduledDate", r.getScheduledDate());
            m.put("startDate", r.getStartDate());
            m.put("endDate", r.getEndDate());
            m.put("expertise", r.getExpertise());
            m.put("scheduledVenue", r.getScheduledVenue());
            m.put("meetingLink", r.getMeetingLink());
            m.put("status", r.getStatus().name());
            m.put("studentCount", count);
            m.put("instituteConfirmed", r.getInstituteConfirmed() != null && r.getInstituteConfirmed());
            return m;
        })
        .toList();
        return ResponseEntity.ok(result);
    }

    // Interviewer sees the list of students for a specific interview
    @PreAuthorize("hasRole('INTERVIEWER')")
    @GetMapping("/assigned-interviews/{id}/students")
    public ResponseEntity<?> getStudentsForInterview(@PathVariable Long id, Authentication auth) {
        Interviewer interviewer = interviewerRepository.findByUserEmail(auth.getName())
            .orElseThrow(() -> new RuntimeException("Interviewer not found"));

        var req = interviewRequestRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Interview request not found"));
        boolean allowed = (req.getAssignedInterviewer() != null && req.getAssignedInterviewer().getId().equals(interviewer.getId()))
                || (req.getAssignedInterviewerIds() != null && req.getAssignedInterviewerIds().contains(interviewer.getId()));
        if (!allowed) {
            return ResponseEntity.status(403).body("You are not allowed to access this interview");
        }

        List<StudentApplication> apps = applicationRepository.findByInterviewRequestId(id);
        List<Map<String, Object>> result = apps.stream().map(a -> {
            Map<String, Object> m = new HashMap<>();
            m.put("applicationId", a.getId());
            m.put("studentName",
                a.getStudent().getFirstName() + " " + a.getStudent().getLastName());
            m.put("studentEmail", a.getStudent().getUser().getEmail());
            m.put("cgpa", a.getStudent().getCgpa());
            m.put("studentClass", a.getStudent().getStudentClass());
            m.put("applicationStatus", a.getStatus().name());
            m.put("appliedAt", a.getAppliedAt());
            // Include resume info so interviewers can view student resumes
            String resumeFileName = a.getStudent().getResumeUrl();
            m.put("resumeFileName", resumeFileName);
            m.put("resumeUrl", (resumeFileName != null && !resumeFileName.isBlank())
                ? "/uploads/" + resumeFileName : null);
            // Include extra profile info for the live interview panel
            m.put("skills", a.getStudent().getSkills());
            m.put("about", a.getStudent().getAbout());
            m.put("profilePhotoUrl", a.getStudent().getProfilePhotoUrl());
            return m;
        }).toList();
        return ResponseEntity.ok(result);
    }

    // Interviewer profile
    @PreAuthorize("hasRole('INTERVIEWER')")
    @GetMapping("/me")
    public ResponseEntity<?> getProfile(Authentication auth) {
        Interviewer iv = interviewerRepository.findByUserEmail(auth.getName())
            .orElseThrow(() -> new RuntimeException("Interviewer not found"));
        Map<String, Object> m = new HashMap<>();
        m.put("id", iv.getId());
        m.put("fullName", iv.getFullName());
        m.put("phone", iv.getPhone());
        m.put("location", iv.getLocation());
        m.put("jobTitle", iv.getJobTitle());
        m.put("company", iv.getCompany());
        m.put("experience", iv.getExperience());
        m.put("domain", iv.getDomain());
        m.put("qualification", iv.getQualification());
        m.put("linkedin", iv.getLinkedin());
        m.put("skills", iv.getSkills());
        m.put("bio", iv.getBio());
        m.put("profilePhotoUrl", iv.getProfilePhotoUrl());
        m.put("createdAt", iv.getCreatedAt());
        m.put("email", iv.getUser() != null ? iv.getUser().getEmail() : null);
        m.put("status", iv.getUser() != null && iv.getUser().getStatus() != null ? iv.getUser().getStatus().name() : null);
        // resumeUrl is stored as a full path e.g. "/uploads/resumes/filename.pdf" — use it directly
        String rawResume = iv.getResumeUrl();
        m.put("resumeUrl", (rawResume != null && !rawResume.isBlank()) ? rawResume : null);
        m.put("resumeFileName", rawResume);
        return ResponseEntity.ok(m);
    }
}