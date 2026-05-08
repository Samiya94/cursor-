package com.interviewPlatform.controllers;

import com.interviewPlatform.entities.Domain;
import com.interviewPlatform.repositories.DomainRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/domains")
@RequiredArgsConstructor
@CrossOrigin
public class DomainController {

    private final DomainRepository domainRepository;

    /** Public — used by register page and institute dashboard (no auth needed) */
    @GetMapping
    public ResponseEntity<List<String>> getAllDomains() {
        List<String> names = domainRepository.findAll()
                .stream()
                .map(Domain::getName)
                .sorted()
                .toList();
        return ResponseEntity.ok(names);
    }

    /** Admin only — add a domain */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<?> addDomain(@RequestBody Map<String, String> body) {
        String name = body.getOrDefault("name", "").trim();
        if (name.isEmpty()) {
            return ResponseEntity.badRequest().body("Domain name is required");
        }
        if (domainRepository.existsByNameIgnoreCase(name)) {
            return ResponseEntity.badRequest().body("Domain already exists");
        }
        Domain saved = domainRepository.save(new Domain(null, name));
        return ResponseEntity.ok(saved.getName());
    }

    /** Admin only — remove a domain by name */
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping
    public ResponseEntity<?> removeDomain(@RequestBody Map<String, String> body) {
        String name = body.getOrDefault("name", "").trim();
        return domainRepository.findByNameIgnoreCase(name)
                .map(d -> { domainRepository.delete(d); return ResponseEntity.ok("Deleted"); })
                .orElse(ResponseEntity.notFound().build());
    }
}