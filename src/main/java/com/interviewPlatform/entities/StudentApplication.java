package com.interviewPlatform.entities;

import java.time.LocalDateTime;

import com.interviewPlatform.enums.Status;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "student_applications",
       uniqueConstraints = @UniqueConstraint(
           columnNames = {"student_id", "interview_request_id"},
           name = "uq_student_interview"
       ))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class StudentApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interview_request_id", nullable = false)
    private InterviewRequest interviewRequest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_interviewer_id")
    private Interviewer assignedInterviewer;

    @Enumerated(EnumType.STRING)
    private Status status;  // PENDING, APPROVED, REJECTED

    private LocalDateTime appliedAt;

    // ── NEW: Path to the interview video uploaded by the interviewer ──
    // Stored as a relative path e.g. "interview-videos/1234_student_interview.mp4"
    private String videoUrl;

    @PrePersist
    public void onCreate() {
        this.appliedAt = LocalDateTime.now();
        if (this.status == null) {
            this.status = Status.PENDING;
        }
    }
}