package com.interviewPlatform.entities;

import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonManagedReference;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "institutes")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Institute {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    @JsonManagedReference
    private User user;

    @Column(nullable = false)
    private String instituteName;
    @Column(nullable = false)
    private String university;

    @Column(nullable = false, unique = true)
    private String instituteCode;

    @Column(nullable = false)
    private String address;
    @Column(nullable = false)
    private String city;
    @Column(nullable = false)
    private String state;

    private String adminName;
    private String designation;

    private String contactNumber;
    private String website;

    private Integer studentStrength;

    @OneToMany(mappedBy = "institute")
    @JsonIgnore
    private List<Department> departments;

    @Column(unique = true)
    private String registrationToken;

    private LocalDateTime tokenCreatedAt;

    private LocalDateTime createdAt;

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

}
