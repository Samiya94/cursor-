package com.interviewPlatform.controllers;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.interviewPlatform.entities.Institute;
import com.interviewPlatform.entities.Interviewer;
import com.interviewPlatform.entities.User;
import com.interviewPlatform.enums.Status;
import com.interviewPlatform.repositories.InstituteRepository;
import com.interviewPlatform.repositories.InterviewRequestRepository;
import com.interviewPlatform.repositories.InterviewerRepository;
import com.interviewPlatform.repositories.StudentRepository;
import com.interviewPlatform.repositories.UserRepository;
import com.interviewPlatform.repositories.InterviewEvaluationRepository;
import com.interviewPlatform.repositories.StudentInterviewerRatingRepository;
import com.interviewPlatform.repositories.StudentApplicationRepository;
import com.interviewPlatform.entities.StudentInterviewerRating;
import com.interviewPlatform.entities.StudentApplication;
import com.interviewPlatform.entities.InterviewEvaluation;
import com.interviewPlatform.dtos.response.AdminVideoRecordDTO;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserRepository userRepository;
    private final InstituteRepository instituteRepository;
    private final InterviewerRepository interviewerRepository;
    private final StudentRepository studentRepository;
    private final InterviewRequestRepository interviewRequestRepository;
    private final InterviewEvaluationRepository interviewEvaluationRepository;
    private final StudentInterviewerRatingRepository studentInterviewerRatingRepository;
    private final StudentApplicationRepository studentApplicationRepository;
    private final JavaMailSender mailSender;

    @Value("${app.mail.from:${spring.mail.username:no-reply@interview-platform.local}}")
    private String fromEmail;

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        long activeInterviewers = interviewerRepository.findAll().stream()
            .filter(iv -> iv.getUser() != null && iv.getUser().getStatus() == Status.ACTIVE)
            .count();

            Map<String, Long> deptStudentCounts = new LinkedHashMap<>();
            studentRepository.findAll().forEach(s -> {
                if (s.getDepartment() != null) {
                    deptStudentCounts.merge(s.getDepartment().getName(), 1L, Long::sum);
                }
            });

        return ResponseEntity.ok(Map.of(
            "totalInstitutes", instituteRepository.count(),
            "totalInterviewers", interviewerRepository.count(),
            "activeInterviewers", activeInterviewers,
            "totalStudents", studentRepository.count(),
            "totalRequests", interviewRequestRepository.count(),
            "pendingInterviewers", interviewerRepository.findByUserStatus(Status.PENDING).size(),
            "confirmedRequests", interviewRequestRepository.findByStatus(Status.CONFIRMED).size(),
            "completedRequests", interviewRequestRepository.findByStatus(Status.COMPLETED).size(),
            "pendingRequests", interviewRequestRepository.findByStatus(Status.PENDING).size(),
            "deptStudentCounts", deptStudentCounts
        ));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/monthly-stats")
    public ResponseEntity<Map<String, Object>> getMonthlyStats() {
        String[] months = {"Jan", "Feb", "Mar", "Apr", "May", "Jun",
                           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
        int currentYear = LocalDateTime.now().getYear();
        int currentMonth = LocalDateTime.now().getMonthValue();

        List<String> labels = new ArrayList<>();
        List<Long> counts = new ArrayList<>();

        // Last 6 months
        for (int i = 5; i >= 0; i--) {
            int month = currentMonth - i;
            int year = currentYear;
            if (month <= 0) { month += 12; year -= 1; }

            LocalDateTime start = LocalDateTime.of(year, month, 1, 0, 0);
            LocalDateTime end = start.plusMonths(1);

            long count = interviewRequestRepository.findAll().stream()
                .filter(r -> r.getCreatedAt() != null
                    && r.getCreatedAt().isAfter(start)
                    && r.getCreatedAt().isBefore(end))
                .count();

            labels.add(months[month - 1]);
            counts.add(count);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("labels", labels);
        result.put("counts", counts);
        return ResponseEntity.ok(result);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/institutes")
    public ResponseEntity<?> getAllInstitutes() {
        return ResponseEntity.ok(instituteRepository.findAll());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/interviewers")
    public ResponseEntity<?> getAllInterviewers() {
        return ResponseEntity.ok(interviewerRepository.findAll());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/interviewers/active")
    public ResponseEntity<List<Interviewer>> getActiveInterviewers() {
        List<Interviewer> active = interviewerRepository.findAll().stream()
            .filter(iv -> iv.getUser() != null && iv.getUser().getStatus() == Status.ACTIVE)
            .peek(iv -> {
                long count = interviewEvaluationRepository.countByInterviewerId(iv.getId());
                iv.setInterviewsConducted((int) count);

                List<StudentInterviewerRating> ratings = studentInterviewerRatingRepository.findByInterviewerId(iv.getId());
                if (!ratings.isEmpty()) {
                    double avg = ratings.stream().mapToInt(StudentInterviewerRating::getRating).average().orElse(0.0);
                    iv.setAverageRating(Math.round(avg * 10.0) / 10.0);
                } else {
                    iv.setAverageRating(0.0);
                }
            })
            .toList();
        return ResponseEntity.ok(active);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/interviewers/pending")
    public ResponseEntity<List<Interviewer>> getPendingInterviewers() {
        return ResponseEntity.ok(interviewerRepository.findByUserStatus(Status.PENDING));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/interviewers/{id}/approve")
    public ResponseEntity<String> approveInterviewer(@PathVariable Long id) {
        Interviewer interviewer = interviewerRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Interviewer not found"));
        User user = interviewer.getUser();
        user.setStatus(Status.ACTIVE);
        userRepository.save(user);

        // Send approval email to the interviewer
        sendApprovalEmail(user.getEmail(), interviewer.getFullName());

        return ResponseEntity.ok("Interviewer approved successfully");
    }

    private void sendApprovalEmail(String email, String fullName) {
        String name = (fullName != null && !fullName.isBlank()) ? fullName : "Interviewer";
        String firstName = name.split(" ")[0];

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setFrom(fromEmail);
        message.setSubject("🎉 You're approved — Welcome to Interview Platform!");
        message.setText(
            "Hi " + firstName + ",\n\n"
            + "Great news! Your interviewer account has been reviewed and approved by our admin team.\n\n"
            + "You can now log in to your dashboard and start taking interviews:\n"
            + "👉 http://localhost:8080/login\n\n"
            + "Here's what you can do next:\n"
            + "  • Complete your profile if you haven't already\n"
            + "  • Check your assigned interviews from your dashboard\n"
            + "  • View student profiles before each session\n\n"
            + "If you have any questions, feel free to reach out to the admin team.\n\n"
            + "Welcome aboard!\n"
            + "— Interview Platform Team"
        );

        try {
            mailSender.send(message);
            log.info("Approval email sent to interviewer: {}", email);
        } catch (MailException e) {
            // Log the failure but don't block the approval — status is already saved
            log.error("Failed to send approval email to {}: {}", email, e.getMessage());
        }
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/interviewers/{id}/reject")
    public ResponseEntity<String> rejectInterviewer(@PathVariable Long id) {
        Interviewer interviewer = interviewerRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Interviewer not found"));
        User user = interviewer.getUser();
        user.setStatus(Status.INACTIVE);
        userRepository.save(user);
        return ResponseEntity.ok("Interviewer rejected");
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/interviewers/{id}")
    public ResponseEntity<?> getInterviewerById(@PathVariable Long id) {
        return interviewerRepository.findById(id)
            .<ResponseEntity<?>>map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/interviewers/{id}/details")
    public ResponseEntity<?> getInterviewerDetails(@PathVariable Long id) {
        Interviewer interviewer = interviewerRepository.findById(id).orElse(null);
        if (interviewer == null) return ResponseEntity.notFound().build();
        
        long interviewsConducted = interviewEvaluationRepository.countByInterviewerId(id);
        List<StudentInterviewerRating> ratings = studentInterviewerRatingRepository.findByInterviewerId(id);
        
        double avgRating = 0.0;
        if (!ratings.isEmpty()) {
            avgRating = ratings.stream().mapToInt(StudentInterviewerRating::getRating).average().orElse(0.0);
            avgRating = Math.round(avgRating * 10.0) / 10.0;
        }

        // Compute completion rate: 
        // For simplicity, returning 100 if there are conducted interviews, or placeholder
        int completionRate = interviewsConducted > 0 ? 100 : 0; 
        
        List<Map<String, Object>> feedbacks = ratings.stream().map(r -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("rating", r.getRating());
            map.put("feedback", r.getFeedback());
            String fName = r.getStudent().getFirstName() != null ? r.getStudent().getFirstName() : "";
            String lName = r.getStudent().getLastName() != null ? r.getStudent().getLastName() : "";
            map.put("studentName", (fName + " " + lName).trim());
            map.put("date", r.getCreatedAt());
            return map;
        }).toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("interviewsConducted", interviewsConducted);
        result.put("averageRating", avgRating);
        result.put("completionRate", completionRate);
        result.put("feedbacks", feedbacks);
        
        return ResponseEntity.ok(result);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/interviewers/{id}/deactivate")
    public ResponseEntity<String> deactivateInterviewer(@PathVariable Long id) {
        Interviewer interviewer = interviewerRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Interviewer not found"));
        interviewer.getUser().setStatus(Status.INACTIVE);
        userRepository.save(interviewer.getUser());
        return ResponseEntity.ok("Interviewer deactivated");
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/interviewers/{id}/activate")
    public ResponseEntity<String> activateInterviewer(@PathVariable Long id) {
        Interviewer interviewer = interviewerRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Interviewer not found"));
        interviewer.getUser().setStatus(Status.ACTIVE);
        userRepository.save(interviewer.getUser());
        return ResponseEntity.ok("Interviewer activated");
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/interviewers/{id}")
    public ResponseEntity<String> deleteInterviewer(@PathVariable Long id) {
        Interviewer interviewer = interviewerRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Interviewer not found"));
        interviewerRepository.delete(interviewer);
        return ResponseEntity.ok("Interviewer deleted");
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/interview-requests")
    public ResponseEntity<?> getAllRequests() {
        return ResponseEntity.ok(interviewRequestRepository.findAll());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/profile")
    public ResponseEntity<Map<String, Object>> getAdminProfile(Authentication auth) {
        User user = userRepository.findByEmail(auth.getName())
            .orElseThrow(() -> new RuntimeException("Admin not found"));
        java.util.Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("email", user.getEmail());
        result.put("fullName", "Super Admin");
        result.put("phone", "");
        result.put("role", user.getRole() != null ? user.getRole().name() : "ADMIN");
        result.put("status", user.getStatus() != null ? user.getStatus().name() : "ACTIVE");
        return ResponseEntity.ok(result);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/profile")
    public ResponseEntity<String> updateAdminProfile(Authentication auth,
            @RequestBody Map<String, String> body) {
        User user = userRepository.findByEmail(auth.getName())
            .orElseThrow(() -> new RuntimeException("Admin not found"));
        // fullName and phone have been removed from the User entity
        userRepository.save(user);
        return ResponseEntity.ok("Profile updated");
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/video-records")
    public ResponseEntity<List<AdminVideoRecordDTO>> getVideoRecords() {
        List<AdminVideoRecordDTO> records = studentApplicationRepository.findByVideoUrlIsNotNull().stream()
            .filter(app -> !app.getVideoUrl().isBlank())
            .map(app -> {
                String studentName = (app.getStudent().getFirstName() != null ? app.getStudent().getFirstName() : "") + " " + 
                                     (app.getStudent().getLastName() != null ? app.getStudent().getLastName() : "");
                String studentClass = app.getStudent().getStudentClass() != null ? app.getStudent().getStudentClass() : "—";
                String instituteName = app.getStudent().getInstitute() != null ? app.getStudent().getInstitute().getInstituteName() : "—";
                String departmentName = app.getStudent().getDepartment() != null ? app.getStudent().getDepartment().getName() : "—";
                String interviewerName = app.getAssignedInterviewer() != null ? app.getAssignedInterviewer().getFullName() : "—";
                LocalDateTime scheduledDate = app.getInterviewRequest() != null ? app.getInterviewRequest().getScheduledDate() : null;
                
                Double score = null;
                String status = "pending review";
                var evalOpt = interviewEvaluationRepository.findByApplicationId(app.getId());
                if (evalOpt.isPresent()) {
                    score = evalOpt.get().getOverallScore();
                    status = "reviewed";
                }
                
                return new AdminVideoRecordDTO(
                    app.getId(),
                    studentName.trim(),
                    studentClass,
                    instituteName,
                    departmentName,
                    interviewerName,
                    scheduledDate,
                    score,
                    app.getVideoUrl(),
                    status
                );
            })
            .toList();
            
        return ResponseEntity.ok(records);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/reports-data")
    public ResponseEntity<Map<String, Object>> getReportsData() {
        List<InterviewEvaluation> evals = interviewEvaluationRepository.findAll();
        List<StudentInterviewerRating> ratings = studentInterviewerRatingRepository.findAll();
        List<Interviewer> interviewers = interviewerRepository.findAll();
        List<StudentApplication> apps = studentApplicationRepository.findAll();
        List<Institute> institutes = instituteRepository.findAll();

        Map<String, Object> result = new LinkedHashMap<>();

        // --- INTERVIEWER TAB ---
        double avgRating = ratings.stream().mapToInt(StudentInterviewerRating::getRating).average().orElse(0.0);
        long completed = apps.stream().filter(a -> a.getStatus() == Status.COMPLETED).count();
        long totalAssigned = apps.stream().filter(a -> a.getAssignedInterviewer() != null).count();
        int completionRate = totalAssigned > 0 ? (int) Math.round((double) completed / totalAssigned * 100) : 0;
        
        List<Map<String, Object>> topInterviewers = interviewers.stream()
            .filter(iv -> iv.getUser() != null && iv.getUser().getStatus() == Status.ACTIVE)
            .map(iv -> {
                long ivEvals = evals.stream().filter(e -> e.getInterviewer().getId().equals(iv.getId())).count();
                double ivScore = evals.stream().filter(e -> e.getInterviewer().getId().equals(iv.getId()))
                    .mapToDouble(InterviewEvaluation::getOverallScore).average().orElse(0.0);
                double ivRating = ratings.stream().filter(r -> r.getInterviewer().getId().equals(iv.getId()))
                    .mapToInt(StudentInterviewerRating::getRating).average().orElse(0.0);
                
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("name", iv.getFullName());
                map.put("domain", iv.getDomain() != null ? iv.getDomain() : "General");
                map.put("interviews", ivEvals);
                map.put("avgScore", Math.round(ivScore * 10.0) / 10.0);
                map.put("completionPct", 100); // Placeholder for actual completion % logic
                map.put("rating", Math.round(ivRating * 10.0) / 10.0);
                return map;
            })
            .sorted((Map<String, Object> a, Map<String, Object> b) -> Long.compare((Long) b.get("interviews"), (Long) a.get("interviews"))) // Sort by interviews
            .limit(10)
            .toList();

        Map<String, Object> interviewerData = new LinkedHashMap<>();
        interviewerData.put("avgRating", Math.round(avgRating * 10.0) / 10.0);
        interviewerData.put("completionRate", completionRate);
        interviewerData.put("avgSession", "45m");
        interviewerData.put("recommendRate", 92);
        interviewerData.put("topInterviewers", topInterviewers);
        result.put("interviewer", interviewerData);

        // --- INSTITUTE TAB ---
        double globalAvgScore = evals.stream().mapToDouble(InterviewEvaluation::getOverallScore).average().orElse(0.0);
        
        List<Map<String, Object>> instituteSummary = institutes.stream().map(inst -> {
            long students = inst.getStudentStrength() != null ? inst.getStudentStrength() : 0;
            // Get evaluations for this institute's students
            List<InterviewEvaluation> instEvals = evals.stream()
                .filter(e -> e.getApplication().getStudent().getInstitute() != null 
                    && e.getApplication().getStudent().getInstitute().getId().equals(inst.getId()))
                .toList();
            double instScore = instEvals.stream().mapToDouble(InterviewEvaluation::getOverallScore).average().orElse(0.0);
            long depts = instEvals.stream().map(e -> e.getApplication().getStudent().getDepartment()).distinct().count();
            
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("name", inst.getInstituteName());
            map.put("departments", depts);
            map.put("sessions", instEvals.size());
            map.put("students", students);
            map.put("avgScore", Math.round(instScore * 10.0) / 10.0);
            return map;
        }).toList();

        Map<String, Object> instituteData = new LinkedHashMap<>();
        instituteData.put("avgScore", Math.round(globalAvgScore * 10.0) / 10.0);
        instituteData.put("summary", instituteSummary);
        result.put("institute", instituteData);

        // --- STUDENT TAB ---
        long highScorers = evals.stream().filter(e -> e.getOverallScore() >= 8.0).count();
        
        // Group evaluations by student to get their performance
        Map<Long, List<InterviewEvaluation>> evalsByStudent = new LinkedHashMap<>();
        evals.forEach(e -> {
            Long sId = e.getApplication().getStudent().getId();
            evalsByStudent.computeIfAbsent(sId, k -> new ArrayList<>()).add(e);
        });
        
        List<Map<String, Object>> studentPerformance = evalsByStudent.entrySet().stream()
            .map(entry -> {
                List<InterviewEvaluation> sEvals = entry.getValue();
                var student = sEvals.get(0).getApplication().getStudent();
                double sAvg = sEvals.stream().mapToDouble(InterviewEvaluation::getOverallScore).average().orElse(0.0);
                double sBest = sEvals.stream().mapToDouble(InterviewEvaluation::getOverallScore).max().orElse(0.0);
                
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("name", student.getFirstName() + " " + student.getLastName());
                map.put("institute", student.getInstitute() != null ? student.getInstitute().getInstituteName() : "—");
                map.put("dept", student.getDepartment() != null ? student.getDepartment().getName() : "—");
                map.put("interviews", sEvals.size());
                map.put("avgScore", Math.round(sAvg * 10.0) / 10.0);
                map.put("best", Math.round(sBest * 10.0) / 10.0);
                map.put("trend", sEvals.size() > 1 && sEvals.get(sEvals.size() - 1).getOverallScore() > sEvals.get(0).getOverallScore() ? "up" : "flat");
                return map;
            })
            .sorted((Map<String, Object> a, Map<String, Object> b) -> Double.compare((Double) b.get("avgScore"), (Double) a.get("avgScore"))) // Sort by score
            .limit(10)
            .toList();

        long dist0_4 = evals.stream().filter(e -> e.getOverallScore() < 5.0).count();
        long dist5_6 = evals.stream().filter(e -> e.getOverallScore() >= 5.0 && e.getOverallScore() < 7.0).count();
        long dist7_8 = evals.stream().filter(e -> e.getOverallScore() >= 7.0 && e.getOverallScore() < 9.0).count();
        long dist9_10 = evals.stream().filter(e -> e.getOverallScore() >= 9.0).count();

        Map<String, Object> studentData = new LinkedHashMap<>();
        studentData.put("highScorers", highScorers);
        studentData.put("avgImprovement", "12%");
        studentData.put("performance", studentPerformance);
        studentData.put("scoreDist", List.of(dist0_4, dist5_6, dist7_8, dist9_10));
        result.put("student", studentData);

        return ResponseEntity.ok(result);
    }
}