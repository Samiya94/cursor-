package com.interviewPlatform.entities;

import java.time.LocalDateTime;
import java.util.List;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "interviewers")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Interviewer {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    private String fullName;
    private String phone;
    private String location;
    @Column(name = "job_title")
    private String jobTitle;
    private String company;
    private String experience;

    private String domain;
    private String qualification;

    private String linkedin;

    @ElementCollection
    @CollectionTable(name = "interviewer_skills", joinColumns = @JoinColumn(name = "interviewer_id"))
    @Column(name = "skill")
    private List<String> skills;

    private String interviewExperience;

    @Column(length = 1000)
    private String bio;

    private String profilePhotoUrl;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate(){
        this.createdAt=LocalDateTime.now();
    }

}
