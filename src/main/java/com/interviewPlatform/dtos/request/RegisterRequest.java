package com.interviewPlatform.dtos.request;

import com.interviewPlatform.enums.Role;

public record RegisterRequest(
    String email,
    String password,
    Role role
) {

}
