package com.interviewPlatform.services.Impl;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.interviewPlatform.entities.InterviewRequest;
import com.interviewPlatform.entities.Interviewer;
import com.interviewPlatform.entities.StudentApplication;
import com.interviewPlatform.repositories.InterviewerRepository;
import com.interviewPlatform.repositories.StudentApplicationRepository;
import com.interviewPlatform.services.InterviewerAssignmentService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class InterviewerAssignmentServiceImpl implements InterviewerAssignmentService {

    private final InterviewerRepository interviewerRepository;
    private final StudentApplicationRepository applicationRepository;

    @Override
    @Transactional
    public void assignRandomInterviewer(StudentApplication application, InterviewRequest request) {
        if (application.getAssignedInterviewer() != null) {
            return;
        }
        List<Long> ids = resolveInterviewerIds(request);
        if (ids.isEmpty()) {
            return;
        }
        Long pickedId = ids.get(ThreadLocalRandom.current().nextInt(ids.size()));
        Interviewer interviewer = interviewerRepository.findById(pickedId)
                .orElseThrow(() -> new RuntimeException("Interviewer not found"));
        application.setAssignedInterviewer(interviewer);
        applicationRepository.save(application);
    }

    @Override
    @Transactional
    public void assignAllUnassignedForRequest(Long interviewRequestId) {
        List<StudentApplication> apps = applicationRepository.findByInterviewRequestId(interviewRequestId);
        if (apps.isEmpty()) {
            return;
        }
        InterviewRequest request = apps.get(0).getInterviewRequest();
        for (StudentApplication app : apps) {
            if (app.getAssignedInterviewer() == null) {
                assignRandomInterviewer(app, request);
            }
        }
    }

    private List<Long> resolveInterviewerIds(InterviewRequest request) {
        List<Long> ids = new ArrayList<>();
        if (request.getAssignedInterviewerIds() != null) {
            ids.addAll(request.getAssignedInterviewerIds());
        }
        if (ids.isEmpty() && request.getAssignedInterviewer() != null) {
            ids.add(request.getAssignedInterviewer().getId());
        }
        return ids;
    }
}
