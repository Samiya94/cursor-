package com.interviewPlatform.services.Impl;

import java.time.format.DateTimeFormatter;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.interviewPlatform.dtos.response.StudentApplicationResponseDTO;
import com.interviewPlatform.entities.InterviewRequest;
import com.interviewPlatform.entities.Student;
import com.interviewPlatform.entities.StudentApplication;
import com.interviewPlatform.enums.Status;
import com.interviewPlatform.repositories.InterviewRequestRepository;
import com.interviewPlatform.repositories.StudentApplicationRepository;
import com.interviewPlatform.repositories.StudentRepository;
import com.interviewPlatform.services.InterviewerAssignmentService;
import com.interviewPlatform.services.StudentApplicationService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class StudentApplicationServiceImpl implements StudentApplicationService {

    private static final Logger log = LoggerFactory.getLogger(StudentApplicationServiceImpl.class);
    private static final DateTimeFormatter DISPLAY_FMT =
            DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a");

    private final StudentApplicationRepository applicationRepository;
    private final StudentRepository studentRepository;
    private final InterviewRequestRepository interviewRequestRepository;
    private final JavaMailSender mailSender;
    private final InterviewerAssignmentService interviewerAssignmentService;

    @Value("${app.mail.from:${spring.mail.username:no-reply@interview-platform.local}}")
    private String fromEmail;

    @Override
    @Transactional
    public void applyToInterview(Long interviewRequestId, String studentEmail) {
        Student student = studentRepository.findByUserEmail(studentEmail)
            .orElseThrow(() -> new RuntimeException("Student not found"));

        InterviewRequest request = interviewRequestRepository.findById(interviewRequestId)
            .orElseThrow(() -> new RuntimeException("Interview not found"));

        // Only allow applying when status is CONFIRMED or RESCHEDULED
        if (request.getStatus() != Status.CONFIRMED && request.getStatus() != Status.RESCHEDULED) {
            throw new RuntimeException("This interview is not open for applications");
        }

        // Check student belongs to the same institute
        if (!student.getInstitute().getId().equals(request.getInstitute().getId())) {
            throw new RuntimeException("This interview is not from your institute");
        }

        // Prevent duplicate applications
        if (applicationRepository.existsByStudentIdAndInterviewRequestId(
                student.getId(), interviewRequestId)) {
            throw new RuntimeException("You have already applied for this interview");
        }

        // Auto-approve immediately — no admin approval step needed
        StudentApplication application = new StudentApplication();
        application.setStudent(student);
        application.setInterviewRequest(request);
        application.setStatus(Status.APPROVED);
        applicationRepository.save(application);
        interviewerAssignmentService.assignRandomInterviewer(application, request);

        // Send confirmation email to student
        sendInterviewConfirmationEmail(student, request);
    }

    private void sendInterviewConfirmationEmail(Student student, InterviewRequest request) {
        try {
            String studentEmail = student.getUser().getEmail();
            String studentName  = student.getFirstName() + " " + student.getLastName();

            String dateStr = request.getScheduledDate() != null
                    ? request.getScheduledDate().format(DISPLAY_FMT)
                    : (request.getStartDate() != null ? request.getStartDate().format(DISPLAY_FMT) : "To be announced");

            StringBuilder body = new StringBuilder();
            body.append("Dear ").append(studentName).append(",\n\n");
            body.append("Your interview has been confirmed. Here are the details:\n\n");
            body.append("Department  : ").append(request.getDepartmentName() != null ? request.getDepartmentName() : "").append("\n");
            body.append("Date & Time : ").append(dateStr).append("\n");

            if (request.getScheduledVenue() != null && !request.getScheduledVenue().isBlank()) {
                body.append("Venue       : ").append(request.getScheduledVenue()).append("\n");
            }
            if (request.getMeetingLink() != null && !request.getMeetingLink().isBlank()) {
                body.append("Meeting Link: ").append(request.getMeetingLink()).append("\n");
            }
            if (request.getContactPerson() != null && !request.getContactPerson().isBlank()) {
                body.append("Contact     : ").append(request.getContactPerson());
                if (request.getContactEmail() != null && !request.getContactEmail().isBlank()) {
                    body.append(" (").append(request.getContactEmail()).append(")");
                }
                body.append("\n");
            }

            body.append("\nPlease log in to your dashboard to view full details and join your interview.\n");
            body.append("\nBest of luck!\nInterview Platform Team");

            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(studentEmail);
            message.setFrom(fromEmail);
            message.setSubject("Interview Confirmed — " + (request.getDepartmentName() != null ? request.getDepartmentName() : "Interview"));
            message.setText(body.toString());

            mailSender.send(message);
            log.info("Interview confirmation email sent to {}", studentEmail);
        } catch (Exception e) {
            // Do not fail the transaction if email fails — application is already saved
            log.error("Failed to send confirmation email to student {}: {}", student.getUser().getEmail(), e.getMessage());
        }
    }

    @Override
    @Transactional
    public void withdrawApplication(Long applicationId, String studentEmail) {
        StudentApplication app = applicationRepository.findById(applicationId)
            .orElseThrow(() -> new RuntimeException("Application not found"));

        if (!app.getStudent().getUser().getEmail().equals(studentEmail)) {
            throw new RuntimeException("You can only withdraw your own applications");
        }
        applicationRepository.delete(app);
    }

    @Override
    public List<StudentApplicationResponseDTO> getMyApplications(String studentEmail) {
        Student student = studentRepository.findByUserEmail(studentEmail)
            .orElseThrow(() -> new RuntimeException("Student not found"));
        return applicationRepository.findByStudentId(student.getId())
            .stream().map(this::mapToDTO).toList();
    }

    @Override
    public List<StudentApplicationResponseDTO> getApplicantsForInterview(Long interviewRequestId) {
        return applicationRepository.findByInterviewRequestId(interviewRequestId)
            .stream().map(this::mapToDTO).toList();
    }

    @Override
    @Transactional
    public void updateApplicationStatus(Long applicationId, Status status) {
        StudentApplication app = applicationRepository.findById(applicationId)
            .orElseThrow(() -> new RuntimeException("Application not found"));
        app.setStatus(status);
        applicationRepository.save(app);
    }

    private StudentApplicationResponseDTO mapToDTO(StudentApplication app) {
        var req = app.getInterviewRequest();
        return new StudentApplicationResponseDTO(
            app.getId(),
            app.getStudent().getId(),
            app.getStudent().getFirstName() + " " + app.getStudent().getLastName(),
            app.getStudent().getUser().getEmail(),
            app.getStudent().getCgpa(),
            app.getStudent().getStudentClass(),
            req.getId(),
            req.getDepartmentName(),
            req.getStatus().name(),
            app.getStatus().name(),
            app.getAppliedAt(),
            req.getScheduledDate(),
            req.getScheduledVenue(),
            req.getMeetingLink(),
            req.getContactPerson(),
            app.getAssignedInterviewer() != null
                    ? app.getAssignedInterviewer().getFullName()
                    : (req.getAssignedInterviewer() != null ? req.getAssignedInterviewer().getFullName() : null),
            app.getVideoUrl() != null && !app.getVideoUrl().isBlank() ? "/uploads/" + app.getVideoUrl() : null
        );
    }
}