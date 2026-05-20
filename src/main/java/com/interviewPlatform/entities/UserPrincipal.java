package com.interviewPlatform.entities;

import java.util.Collection;
import java.util.Collections;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import com.interviewPlatform.enums.Role;
import com.interviewPlatform.enums.Status;

import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;


@NoArgsConstructor
@AllArgsConstructor
public class UserPrincipal implements UserDetails {

    private User user;

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return Collections.singleton(new SimpleGrantedAuthority("ROLE_" + user.getRole()));
    }

    @Override
    public String getPassword() {
        return user.getPassword();
    }

    @Override
    public String getUsername() {
        return user.getEmail();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return user.getStatus() != Status.INACTIVE;
    }

    @Override
    public boolean isEnabled() {
        // FIX: ADMIN accounts are always enabled regardless of status.
        // Previously, isEnabled() returned false for any non-ACTIVE status,
        // which caused Spring Security to reject admin requests with 403
        // even when the admin was legitimately logged in — blocking actions
        // like adding/removing domains in the Settings tab.
        if (user.getRole() == Role.ADMIN) {
            return true;
        }
        return user.getStatus() == Status.ACTIVE;
    }
}