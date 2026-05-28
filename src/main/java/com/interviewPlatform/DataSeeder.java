package com.interviewPlatform;

import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.interviewPlatform.entities.User;
import com.interviewPlatform.repositories.UserRepository;
import com.interviewPlatform.enums.Role;
import com.interviewPlatform.enums.Status;
import java.time.LocalDateTime;

@Component
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        if (userRepository.findByEmail("admin@platform.com").isEmpty()) {
            User admin = new User();
            admin.setEmail("admin@platform.com");
            admin.setPassword(passwordEncoder.encode("admin123"));
            admin.setRole(Role.ADMIN);
            admin.setStatus(Status.ACTIVE);
            admin.setCreatedAt(LocalDateTime.now());
            userRepository.save(admin);
            System.out.println("Default Admin Account Created: admin@platform.com / admin123");
        }
    }
}
