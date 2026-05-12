package com.interviewPlatform.services;

import java.util.List;

import com.interviewPlatform.dtos.request.InterviewRequestDTO;
import com.interviewPlatform.dtos.request.ScheduleInterviewDTO;
import com.interviewPlatform.dtos.response.InterviewRequestResponseDTO;
import com.interviewPlatform.enums.Status;

public interface InterviewRequestService {
    void createRequest(InterviewRequestDTO dto);
    List<InterviewRequestResponseDTO> getMyRequests();
    long getPendingCount();
    void updateStatus(Long id, Status status);
    void updateStatusByInstitute(Long id, Status status);
    void confirmByInstitute(Long id);
    void rejectRescheduleByInstitute(Long id);
    void assignInterviewer(Long id, java.util.List<Long> interviewerIds);
    // NEW
    List<InterviewRequestResponseDTO> getAllRequests();
    void scheduleInterview(Long id, ScheduleInterviewDTO dto);
    void rescheduleInterview(Long id, ScheduleInterviewDTO dto);
    List<InterviewRequestResponseDTO> getConfirmedRequestsForInstitute(Long instituteId);
}