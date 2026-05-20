package com.interviewPlatform.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import com.interviewPlatform.filters.JwtFilter;

@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;
    private final UserDetailsService userDetailsService;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        return http
            .csrf(customizer -> customizer.disable())
            // Allow same-origin iframes (needed for PDF resume viewer)
            .headers(headers -> headers
                .frameOptions(frameOptions -> frameOptions.sameOrigin())
            )
            .authorizeHttpRequests(request -> request

                // Explicitly allow POST for auth endpoints
                .requestMatchers(HttpMethod.POST, "/login").permitAll()
                .requestMatchers(HttpMethod.POST, "/logout").permitAll()
                .requestMatchers(HttpMethod.POST, "/refresh").permitAll()
                .requestMatchers(HttpMethod.POST, "/register").permitAll()
                .requestMatchers(HttpMethod.POST, "/register/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/password-reset/**").permitAll()

                // GET /api/domains is public (used on registration pages)
                .requestMatchers(HttpMethod.GET, "/api/domains").permitAll()

                // FIX: POST and DELETE /api/domains must be explicitly restricted to ADMIN
                // Without these rules they fall through to the generic /api/** catch-all
                // which only checks "authenticated" — bypassing the role check entirely.
                .requestMatchers(HttpMethod.POST, "/api/domains").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/domains").hasRole("ADMIN")

                // All public paths (GET pages)
                .requestMatchers(
                    "/",
                    "/login",
                    "/register",
                    "/register/**",
                    "/refresh",
                    "/logout",
                    "/api/students/check-email",
                    "/css/**",
                    "/js/**",
                    "/images/**",
                    "/uploads/**",
                    "/favicon.ico",
                    "/favicon.svg",
                    "/departments/institute/**",
                    "/institute-dashboard",
                    "/student-dashboard",
                    "/mentor-dashboard",
                    "/interviewer-dashboard",
                    "/admin-dashboard",
                    "/admin-login",
                    "/forgot-password",
                    "/api/password-reset/**"
                ).permitAll()

                // API role-based — specific rules BEFORE generic catch-all
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/mentor/**").hasRole("MENTOR")
                .requestMatchers("/api/students/**").hasRole("STUDENT")
                .requestMatchers("/api/student/**").hasRole("STUDENT")
                .requestMatchers("/api/interviewer/**").hasRole("INTERVIEWER")
                .requestMatchers("/api/applications/**").hasAnyRole("STUDENT", "INSTITUTE", "MENTOR", "ADMIN", "INTERVIEWER")
                .requestMatchers(HttpMethod.GET, "/api/institutes/*/public").permitAll()
                .requestMatchers("/api/institutes/**").hasAnyRole("INSTITUTE", "ADMIN")
                .requestMatchers("/api/interview-requests/**").hasAnyRole("INSTITUTE", "ADMIN")
                .requestMatchers("/departments/stats/**").hasRole("INSTITUTE")
                .requestMatchers("/departments/**").hasAnyRole("INSTITUTE", "ADMIN")

                // Generic catch-all — MUST be last
                .requestMatchers("/api/**").authenticated()
                .anyRequest().authenticated()
            )
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .authenticationProvider(authenticationProvider())
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .logout(logout -> logout.disable())
            .build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider =
            new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}