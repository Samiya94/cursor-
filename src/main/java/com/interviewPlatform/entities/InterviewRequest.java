package com.interviewPlatform.entities;

import java.time.LocalDateTime;
import java.util.List;

import com.interviewPlatform.enums.Status;

import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "interview_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class InterviewRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String departmentName;
    @ElementCollection
    private List<String> expertise;

    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private String contactPerson;
    private String contactEmail;
    private String remarks;

    @Enumerated(EnumType.STRING)
    private Status status; 

    @ManyToOne
    @JoinColumn(name = "institute_id")
    private Institute institute;

    private LocalDateTime createdAt;
    private Integer numberOfInterviewers;

    @ManyToOne
    @JoinColumn(name = "interviewer_id")
    private Interviewer assignedInterviewer;

    @ElementCollection
    @CollectionTable(name = "interview_request_interviewers", joinColumns = @JoinColumn(name = "interview_request_id"))
    @Column(name = "interviewer_id")
    private List<Long> assignedInterviewerIds;

    // Scheduling fields — set by admin when scheduling the interview
    private LocalDateTime scheduledDate;

    private String scheduledVenue;

    private String meetingLink;

    private Integer numberOfStudentsRequired;
    private Integer registeredStudentsCount;
    private Boolean instituteConfirmed;

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.instituteConfirmed == null) {
            this.instituteConfirmed = false;
        }
    }

}
