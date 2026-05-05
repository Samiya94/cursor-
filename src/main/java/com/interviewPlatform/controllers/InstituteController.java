package com.interviewPlatform.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.interviewPlatform.services.InstituteService;
import com.interviewPlatform.services.MentorService;
import com.interviewPlatform.services.Impl.JWTService;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/institutes")
@CrossOrigin
@RequiredArgsConstructor
public class InstituteController {

    private final InstituteService instituteService;
    private final JWTService jwtService;
    private final MentorService mentorService;

    @GetMapping("/{id}")
    public ResponseEntity<?> getInstitute(@PathVariable Long id){
        return ResponseEntity.ok(instituteService.getInstituteById(id));
    }

    // Public endpoint — only exposes name, used by mentor/student registration pages
    @GetMapping("/{id}/public")
    public ResponseEntity<?> getInstitutePublic(@PathVariable Long id) {
        var inst = instituteService.getInstituteById(id);
        return ResponseEntity.ok(inst);
    }

    // // Spring Security already has this
    // @GetMapping("/me")
    // public ResponseEntity<?> getMyInstitute(Authentication authentication) {
    //     return ResponseEntity.ok(instituteService.getInstituteByEmail(authentication.getName()));
    // }

    @GetMapping("/me")
    public ResponseEntity<?> getMyInstitute(HttpServletRequest request){
        //extract token from header
        String authHeader=request.getHeader("Authorization");

        if(authHeader == null || !authHeader.startsWith("Bearer ")){
            return ResponseEntity.status(401).body("No Token Found");
        }

        String token=authHeader.substring(7);

        //extract email from JWT
        String email=jwtService.extractUserName(token);

        //fetch institute using email
        return ResponseEntity.ok(instituteService.getInstituteByEmail(email));
    }

    @GetMapping("/{id}/mentors")
    public ResponseEntity<?> getMentors(@PathVariable Long id){
        return ResponseEntity.ok(mentorService.getMentorsByInstitute(id));
    }

}
