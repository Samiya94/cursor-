package com.interviewPlatform.services.Impl;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.interviewPlatform.entities.User;
import com.interviewPlatform.entities.UserPrincipal;
import com.interviewPlatform.repositories.UserRepository;


import lombok.RequiredArgsConstructor;
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService{

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {

        User user=userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
        if(user == null){
            System.out.println("User Not Found");
            throw new UsernameNotFoundException("User Not Found");
        }

       return new UserPrincipal(user);
    }

    
}
