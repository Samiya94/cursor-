package com.interviewPlatform.entities;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "platform_domains")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Domain {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;
}