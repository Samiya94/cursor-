package com.interviewPlatform.repositories;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.interviewPlatform.entities.Interviewer;
import com.interviewPlatform.entities.User;
import com.interviewPlatform.enums.Status;

public interface InterviewerRepository extends JpaRepository<Interviewer,Long>{
    Optional<Interviewer> findByUser(User user);
    Optional<Interviewer> findByUserEmail(String email);
    List<Interviewer> findByUserStatus(Status status); 
}
