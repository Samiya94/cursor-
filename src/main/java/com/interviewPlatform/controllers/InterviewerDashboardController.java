package com.interviewPlatform.controllers;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.interviewPlatform.entities.Interviewer;
import com.interviewPlatform.entities.StudentApplication;
import com.interviewPlatform.repositories.InterviewEvaluationRepository;
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
    private final InterviewEvaluationRepository evaluationRepository;

    @Value("${file.upload.dir:uploads/}")
    private String uploadDir;

    // ── Interviewer sees interviews they are assigned to ──
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

    // ── Interviewer sees the list of students for a specific interview ──
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

        List<StudentApplication> apps = applicationRepository.findByInterviewRequestId(id).stream()
                .filter(a -> a.getAssignedInterviewer() != null
                        && a.getAssignedInterviewer().getId().equals(interviewer.getId()))
                .toList();
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
            // Resume info
            String resumeFileName = a.getStudent().getResumeUrl();
            m.put("resumeFileName", resumeFileName);
            m.put("resumeUrl", (resumeFileName != null && !resumeFileName.isBlank())
                ? "/uploads/" + resumeFileName : null);
            // Extra profile info
            m.put("skills", a.getStudent().getSkills());
            m.put("about", a.getStudent().getAbout());
            m.put("projectName", a.getStudent().getProjectName());
            m.put("projectBrief", a.getStudent().getProjectBrief());
            m.put("projectGithub", a.getStudent().getProjectGithub());
            m.put("profilePhotoUrl", a.getStudent().getProfilePhotoUrl());
            m.put("evaluationSubmitted", evaluationRepository.existsByApplicationId(a.getId()));
            // ── NEW: include video URL if a video has been uploaded for this student ──
            String videoUrl = a.getVideoUrl();
            m.put("videoUrl", (videoUrl != null && !videoUrl.isBlank())
                ? "/uploads/" + videoUrl : null);
            return m;
        }).toList();
        return ResponseEntity.ok(result);
    }

    // ── NEW: Upload interview video for a specific student application ──
    @PreAuthorize("hasRole('INTERVIEWER')")
    @PostMapping("/assigned-interviews/{interviewId}/students/{applicationId}/upload-video")
    public ResponseEntity<?> uploadInterviewVideo(
            @PathVariable Long interviewId,
            @PathVariable Long applicationId,
            @RequestParam("video") MultipartFile videoFile,
            Authentication auth) {

        // 1. Verify the interviewer is assigned to this interview
        Interviewer interviewer = interviewerRepository.findByUserEmail(auth.getName())
            .orElseThrow(() -> new RuntimeException("Interviewer not found"));

        var req = interviewRequestRepository.findById(interviewId)
            .orElseThrow(() -> new RuntimeException("Interview request not found"));

        boolean allowed = (req.getAssignedInterviewer() != null && req.getAssignedInterviewer().getId().equals(interviewer.getId()))
                || (req.getAssignedInterviewerIds() != null && req.getAssignedInterviewerIds().contains(interviewer.getId()));
        if (!allowed) {
            return ResponseEntity.status(403).body("You are not assigned to this interview");
        }

        // 2. Find the student application and confirm it belongs to this interview
        StudentApplication application = applicationRepository.findById(applicationId)
            .orElseThrow(() -> new RuntimeException("Student application not found"));

        if (!application.getInterviewRequest().getId().equals(interviewId)) {
            return ResponseEntity.status(400).body("Application does not belong to this interview");
        }

        if (application.getAssignedInterviewer() == null
                || !application.getAssignedInterviewer().getId().equals(interviewer.getId())) {
            return ResponseEntity.status(403).body("You are not assigned to this student");
        }

        // 3. Validate the uploaded file is a video
        String originalFilename = videoFile.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            return ResponseEntity.badRequest().body("Invalid file name");
        }
        String ext = originalFilename.substring(originalFilename.lastIndexOf('.') + 1).toLowerCase();
        List<String> allowedExtensions = List.of("mp4", "webm", "mov", "avi", "mkv");
        if (!allowedExtensions.contains(ext)) {
            return ResponseEntity.badRequest()
                .body("Unsupported video format. Allowed: mp4, webm, mov, avi, mkv");
        }

        // 4. Save the file to uploads/interview-videos/
        try {
            String dir = (uploadDir == null || uploadDir.isBlank()) ? "uploads/" : uploadDir;
            if (!dir.endsWith("/") && !dir.endsWith(File.separator)) dir = dir + "/";

            Path videosDir = Paths.get(dir + "interview-videos/");
            Files.createDirectories(videosDir);

            // Unique filename: timestamp_interviewId_applicationId_originalName
            String savedFilename = System.currentTimeMillis()
                + "_iv" + interviewId
                + "_app" + applicationId
                + "_" + originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_");

            Path destination = videosDir.resolve(savedFilename);
            try (var inputStream = videoFile.getInputStream()) {
                Files.copy(inputStream, destination,
                    java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            }

            // 5. Persist the relative path on the application record
            String relativeVideoPath = "interview-videos/" + savedFilename;
            application.setVideoUrl(relativeVideoPath);
            applicationRepository.save(application);

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Video uploaded successfully");
            response.put("videoUrl", "/uploads/" + relativeVideoPath);
            return ResponseEntity.ok(response);

        } catch (IOException e) {
            return ResponseEntity.status(500)
                .body("Failed to save video: " + e.getMessage());
        }
    }

    // ── Interviewer profile ──
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
        String rawResume = iv.getResumeUrl();
        m.put("resumeUrl", (rawResume != null && !rawResume.isBlank()) ? rawResume : null);
        m.put("resumeFileName", rawResume);
        return ResponseEntity.ok(m);
    }
}