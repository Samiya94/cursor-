package com.interviewPlatform.dtos.request;

import java.time.LocalDateTime;

public record ScheduleInterviewDTO(
    LocalDateTime scheduledDate,
    String scheduledVenue,
    String meetingLink,
    Long assignedInterviewerId,
    java.util.List<Long> assignedInterviewerIds,
    Integer numberOfStudentsRequired
) {

}
