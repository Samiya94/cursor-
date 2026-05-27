package com.interviewPlatform.services.Impl;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.ArrayList;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.interviewPlatform.dtos.request.InterviewRequestDTO;
import com.interviewPlatform.dtos.request.ScheduleInterviewDTO;
import com.interviewPlatform.dtos.response.InterviewRequestResponseDTO;
import com.interviewPlatform.entities.Institute;
import com.interviewPlatform.entities.InterviewRequest;
import com.interviewPlatform.entities.Interviewer;
import com.interviewPlatform.enums.Status;
import com.interviewPlatform.repositories.InstituteRepository;
import com.interviewPlatform.repositories.InterviewRequestRepository;
import com.interviewPlatform.repositories.InterviewerRepository;
import com.interviewPlatform.services.InterviewRequestService;
import com.interviewPlatform.services.InterviewerAssignmentService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class InterviewRequestServiceImpl implements InterviewRequestService {

    private final InterviewRequestRepository requestRepo;
    private final InstituteRepository instituteRepo;
    private final InterviewerRepository interviewerRepository;
    private final JavaMailSender mailSender;
    private final InterviewerAssignmentService interviewerAssignmentService;

    @Value("${app.mail.from:${spring.mail.username:no-reply@interview-platform.local}}")
    private String fromEmail;

    private static LocalDateTime parseDateTimeOrNull(String raw) {
        if (raw == null) {
            return null;
        }
        String s = raw.trim();
        if (s.isEmpty()) {
            return null;
        }
        try {
            return LocalDateTime.parse(s);
        } catch (DateTimeParseException ignored) {
            // continue
        }
        try {
            return OffsetDateTime.parse(s).toLocalDateTime();
        } catch (DateTimeParseException ignored) {
            // continue
        }
        try {
            return ZonedDateTime.parse(s).toLocalDateTime();
        } catch (DateTimeParseException ignored) {
            // continue
        }
        throw new RuntimeException("Invalid date/time format: " + raw);
    }

    private Institute getLoggedInInstitute() {
        String email = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        return instituteRepo.findByUserEmail(email)
                .orElseThrow(() -> new RuntimeException("Institute not found"));
    }

    @Override
    @Transactional
    public void createRequest(InterviewRequestDTO dto) {
        Institute institute = getLoggedInInstitute();

        InterviewRequest request = new InterviewRequest();

        request.setDepartmentName(dto.departmentName());
        request.setExpertise(dto.expertise());
        request.setStartDate(dto.startDate());
        request.setEndDate(dto.endDate());
        request.setContactPerson(dto.contactPerson());
        request.setContactEmail(dto.contactEmail());
        request.setRemarks(dto.remarks());
        request.setRegisteredStudentsCount(dto.registeredStudentsCount());
        request.setStatus(Status.PENDING);
        request.setInstituteConfirmed(false);

        request.setInstitute(institute);

        requestRepo.save(request);
    }

    @Override
    public List<InterviewRequestResponseDTO> getMyRequests() {
        Institute institute = getLoggedInInstitute();

        return requestRepo.findByInstituteId(institute.getId())
        .stream()
        .map(this::mapToDTO)
        .toList();
    }

    @Override
    public long getPendingCount() {
        Institute institute = getLoggedInInstitute();

        return requestRepo.countByInstituteIdAndStatus(
                institute.getId(),
                Status.PENDING
        );
    }

    @Override
    @Transactional
    public void updateStatus(Long id, Status status) {
        InterviewRequest req = requestRepo.findById(id)
            .orElseThrow(() -> new RuntimeException("Request not found"));

            req.setStatus(status);

            requestRepo.save(req);
    }

    @Override
    @Transactional
    public void updateStatusByInstitute(Long id, Status status) {
        InterviewRequest req = requestRepo.findById(id)
            .orElseThrow(() -> new RuntimeException("Request not found"));

        Institute institute = getLoggedInInstitute();
        if (req.getInstitute() == null || !req.getInstitute().getId().equals(institute.getId())) {
            throw new RuntimeException("You are not allowed to update this request");
        }

        req.setStatus(status);
        requestRepo.save(req);
    }

    @Override
    @Transactional
    public void confirmByInstitute(Long id) {
        InterviewRequest req = requestRepo.findById(id)
            .orElseThrow(() -> new RuntimeException("Request not found"));

        Institute institute = getLoggedInInstitute();
        if (req.getInstitute() == null || !req.getInstitute().getId().equals(institute.getId())) {
            throw new RuntimeException("You are not allowed to update this request");
        }

        req.setInstituteConfirmed(true);
        if (req.getStatus() == Status.PENDING
                || req.getStatus() == Status.AWAITING_CONFIRMATION
                || req.getStatus() == Status.RESCHEDULED) {
            req.setStatus(Status.CONFIRMED);
        }
        requestRepo.save(req);
        interviewerAssignmentService.assignAllUnassignedForRequest(req.getId());
    }

    @Override
    @Transactional
    public void rejectRescheduleByInstitute(Long id) {
        InterviewRequest req = requestRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        Institute institute = getLoggedInInstitute();
        if (req.getInstitute() == null || !req.getInstitute().getId().equals(institute.getId())) {
            throw new RuntimeException("You are not allowed to update this request");
        }

        if (req.getStatus() != Status.RESCHEDULED) {
            throw new RuntimeException("Only rescheduled requests can be rejected");
        }

        req.setInstituteConfirmed(false);
        req.setStatus(Status.REJECTED);
        requestRepo.save(req);
    }

    @Override
    public List<InterviewRequestResponseDTO> getAllRequests() {
        return requestRepo.findAll().stream().map(this::mapToDTO).toList();
    }

    @Override
    @Transactional
    public void scheduleInterview(Long id, ScheduleInterviewDTO dto) {
        InterviewRequest req = requestRepo.findById(id)
            .orElseThrow(() -> new RuntimeException("Interview request not found"));

        LocalDateTime scheduled = parseDateTimeOrNull(dto.scheduledDate());
        if (scheduled == null && req.getStartDate() != null) {
            scheduled = req.getStartDate();
        }
        req.setScheduledDate(scheduled);
        if (dto.scheduledVenue() != null) {
            req.setScheduledVenue(dto.scheduledVenue());
        }
        if (dto.meetingLink() != null) {
            req.setMeetingLink(dto.meetingLink());
        }
        if (dto.numberOfStudentsRequired() != null) {
            req.setNumberOfStudentsRequired(dto.numberOfStudentsRequired());
        }
        req.setStatus(Status.AWAITING_CONFIRMATION);
        req.setInstituteConfirmed(false);
        req.setAssignedInterviewer(null);
        req.setAssignedInterviewerIds(null);
        if (dto.assignedInterviewerIds() != null && !dto.assignedInterviewerIds().isEmpty()) {
            req.setAssignedInterviewerIds(dto.assignedInterviewerIds());
            Interviewer primary = interviewerRepository.findById(dto.assignedInterviewerIds().get(0))
                .orElseThrow(() -> new RuntimeException("Interviewer not found"));
            req.setAssignedInterviewer(primary);
        } else if (dto.assignedInterviewerId() != null) {
            Interviewer primary = interviewerRepository.findById(dto.assignedInterviewerId())
                .orElseThrow(() -> new RuntimeException("Interviewer not found"));
            req.setAssignedInterviewer(primary);
            req.setAssignedInterviewerIds(java.util.List.of(dto.assignedInterviewerId()));
        }
        requestRepo.save(req);
        interviewerAssignmentService.assignAllUnassignedForRequest(req.getId());
        // Notify assigned interviewers by email
        if (req.getAssignedInterviewerIds() != null && !req.getAssignedInterviewerIds().isEmpty()) {
            notifyInterviewersOfAssignment(req, req.getAssignedInterviewerIds());
        }
    }

    @Override
    @Transactional
    public void rescheduleInterview(Long id, ScheduleInterviewDTO dto) {
        InterviewRequest req = requestRepo.findById(id)
            .orElseThrow(() -> new RuntimeException("Interview request not found"));

        LocalDateTime newStart = parseDateTimeOrNull(dto.startDate());
        if (newStart != null) {
            req.setStartDate(newStart);
        }
        LocalDateTime newEnd = parseDateTimeOrNull(dto.endDate());
        if (newEnd != null) {
            req.setEndDate(newEnd);
        }

        LocalDateTime scheduled = parseDateTimeOrNull(dto.scheduledDate());
        if (scheduled == null && newStart != null) {
            scheduled = newStart;
        }
        if (scheduled != null) {
            req.setScheduledDate(scheduled);
        }
        if (dto.scheduledVenue() != null) {
            req.setScheduledVenue(dto.scheduledVenue());
        }
        if (dto.meetingLink() != null) {
            req.setMeetingLink(dto.meetingLink());
        }
        if (dto.numberOfStudentsRequired() != null) {
            req.setNumberOfStudentsRequired(dto.numberOfStudentsRequired());
        }

        if (dto.assignedInterviewerIds() != null && !dto.assignedInterviewerIds().isEmpty()) {
            req.setAssignedInterviewerIds(dto.assignedInterviewerIds());
            Interviewer primary = interviewerRepository.findById(dto.assignedInterviewerIds().get(0))
                    .orElseThrow(() -> new RuntimeException("Interviewer not found"));
            req.setAssignedInterviewer(primary);
        } else if (dto.assignedInterviewerId() != null) {
            Interviewer primary = interviewerRepository.findById(dto.assignedInterviewerId())
                    .orElseThrow(() -> new RuntimeException("Interviewer not found"));
            req.setAssignedInterviewer(primary);
            req.setAssignedInterviewerIds(java.util.List.of(dto.assignedInterviewerId()));
        }

        req.setStatus(Status.RESCHEDULED);
        req.setInstituteConfirmed(false);
        requestRepo.save(req);
        interviewerAssignmentService.assignAllUnassignedForRequest(req.getId());
    }

    @Override
    @Transactional
    public void assignInterviewer(Long id, List<Long> interviewerIds) {
        InterviewRequest req = requestRepo.findById(id)
            .orElseThrow(() -> new RuntimeException("Interview request not found"));
        if (interviewerIds == null || interviewerIds.isEmpty()) {
            throw new RuntimeException("At least one interviewer is required");
        }
        List<Long> ids = interviewerIds.stream().filter(java.util.Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            throw new RuntimeException("At least one interviewer is required");
        }
        Interviewer interviewer = interviewerRepository.findById(ids.get(0))
            .orElseThrow(() -> new RuntimeException("Interviewer not found"));
        req.setAssignedInterviewer(interviewer);
        req.setAssignedInterviewerIds(ids);
        requestRepo.save(req);
        interviewerAssignmentService.assignAllUnassignedForRequest(req.getId());
        // Notify newly assigned interviewers by email
        notifyInterviewersOfAssignment(req, ids);
    }

    @Override
    public List<InterviewRequestResponseDTO> getConfirmedRequestsForInstitute(Long instituteId) {
        return requestRepo.findByInstituteIdAndStatusIn(
            instituteId,
            java.util.List.of(Status.CONFIRMED, Status.RESCHEDULED, Status.AWAITING_CONFIRMATION)
        ).stream().map(this::mapToDTO).toList();
    }

    /** Send assignment notification email to every assigned interviewer. */
    private void notifyInterviewersOfAssignment(InterviewRequest req, List<Long> ids) {
        if (ids == null || ids.isEmpty()) return;
        List<Interviewer> interviewers = interviewerRepository.findAllById(ids);
        for (Interviewer iv : interviewers) {
            try {
                String toEmail = iv.getUser() != null ? iv.getUser().getEmail() : null;
                if (toEmail == null || toEmail.isBlank()) continue;

                String institute  = req.getInstitute() != null ? req.getInstitute().getInstituteName() : "—";
                String dept       = req.getDepartmentName() != null ? req.getDepartmentName() : "—";
                String scheduled  = req.getScheduledDate() != null
                    ? req.getScheduledDate().toString().replace("T", " at ")
                    : (req.getStartDate() != null ? req.getStartDate().toString().replace("T", " at ") : "TBD");
                String venue      = req.getScheduledVenue() != null ? req.getScheduledVenue() : "—";
                String meetLink   = req.getMeetingLink()    != null ? req.getMeetingLink()    : "—";

                StringBuilder body = new StringBuilder();
                body.append("Dear ").append(iv.getFullName() != null ? iv.getFullName() : "Interviewer").append(",\n\n");
                body.append("You have been assigned to conduct an interview. Here are the details:\n\n");
                body.append("  Institute  : ").append(institute).append("\n");
                body.append("  Department : ").append(dept).append("\n");
                body.append("  Date/Time  : ").append(scheduled).append("\n");
                body.append("  Venue      : ").append(venue).append("\n");
                body.append("  Meeting    : ").append(meetLink).append("\n\n");
                body.append("Please log in to your Interviewer Dashboard to view your full schedule,\n");
                body.append("student list, and meeting details.\n\n");
                body.append("Best regards,\nInterview Platform Team");

                SimpleMailMessage msg = new SimpleMailMessage();
                msg.setTo(toEmail);
                msg.setFrom(fromEmail);
                msg.setSubject("You've been assigned an interview — " + dept + " @ " + institute);
                msg.setText(body.toString());
                mailSender.send(msg);
                log.info("Assignment email sent to interviewer {}", toEmail);
            } catch (Exception e) {
                log.error("Failed to send assignment email to interviewer {}: {}", iv.getId(), e.getMessage());
            }
        }
    }

    private InterviewRequestResponseDTO mapToDTO(InterviewRequest req) {
    List<Long> assignedIds = req.getAssignedInterviewerIds() != null
        ? req.getAssignedInterviewerIds() : new ArrayList<>();
    List<String> assignedNames = assignedIds.isEmpty()
        ? new ArrayList<>()
        : interviewerRepository.findAllById(assignedIds).stream().map(Interviewer::getFullName).toList();
    if ((assignedNames == null || assignedNames.isEmpty()) && req.getAssignedInterviewer() != null) {
        assignedNames = java.util.List.of(req.getAssignedInterviewer().getFullName());
        assignedIds = java.util.List.of(req.getAssignedInterviewer().getId());
    }
    return new InterviewRequestResponseDTO(
        req.getId(),
        req.getDepartmentName(),
        req.getExpertise(),
        req.getStartDate(),
        req.getEndDate(),
        req.getContactPerson(),
        req.getContactEmail(),
        req.getRemarks(),
        req.getStatus().name(),
        req.getCreatedAt(),
        req.getScheduledDate(),
        req.getScheduledVenue(),
        req.getMeetingLink(),
        req.getNumberOfStudentsRequired(),
        req.getRegisteredStudentsCount(),
        req.getInstituteConfirmed(),
        assignedIds,
        assignedNames,
        req.getInstitute() != null ? req.getInstitute().getId() : null,
        req.getInstitute() != null ? req.getInstitute().getInstituteName() : null,
        req.getAssignedInterviewer() != null ? req.getAssignedInterviewer().getId() : null,
        req.getAssignedInterviewer() != null ? req.getAssignedInterviewer().getFullName() : null
    );
}
}