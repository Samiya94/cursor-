package com.interviewPlatform.services.Impl;

import java.util.List;

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
import com.interviewPlatform.services.StudentApplicationService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class StudentApplicationServiceImpl implements StudentApplicationService {

    private final StudentApplicationRepository applicationRepository;
    private final StudentRepository studentRepository;
    private final InterviewRequestRepository interviewRequestRepository;

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

        StudentApplication application = new StudentApplication();
        application.setStudent(student);
        application.setInterviewRequest(request);
        application.setStatus(Status.PENDING);
        applicationRepository.save(application);
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
            req.getAssignedInterviewer() != null ? req.getAssignedInterviewer().getFullName() : null
        );
    }
}