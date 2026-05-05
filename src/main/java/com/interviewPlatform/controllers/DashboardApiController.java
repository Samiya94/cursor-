package com.interviewPlatform.controllers;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class DashboardApiController {

    @PreAuthorize("hasRole('INSTITUTE')")
    @GetMapping("/institute-dashboard")
    public String instituteDashboardData() {
        return "Welcome Institute";
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/admin-dashboard")
    public String adminDashboardData(){
        return "Welcome Admin";
    }

    @PreAuthorize("hasRole('STUDENT')")
    @GetMapping("/student-dashboard")
    public String studentDashboardData(){
        return "Welcome Student";
    }

    @PreAuthorize("hasRole('MENTOR')")
    @GetMapping("/mentor-dashboard")
    public String mentorDashboardData(){
        return "Welcome Mentor";
    }

    @PreAuthorize("hasRole('INTERVIEWER')")
    @GetMapping("/interviewer-dashboard")
    public String interviewerDashboardData(){
        return "Welcome Interviewer";
    }

}
