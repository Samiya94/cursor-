package com.interviewPlatform.dtos.request;

/**
 * Date/time fields are strings so the API accepts ISO local, offset, and Zulu forms
 * from the browser without Jackson {@code LocalDateTime} parsing failures.
 */
public record ScheduleInterviewDTO(
    String scheduledDate,
    String scheduledVenue,
    String meetingLink,
    Long assignedInterviewerId,
    java.util.List<Long> assignedInterviewerIds,
    Integer numberOfStudentsRequired,
    String startDate,
    String endDate
) {

}
