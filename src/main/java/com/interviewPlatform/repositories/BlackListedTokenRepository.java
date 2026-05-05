package com.interviewPlatform.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import com.interviewPlatform.entities.BlacklistedToken;

public interface BlackListedTokenRepository extends JpaRepository<BlacklistedToken,Long> {
    boolean existsByToken(String token);

}
