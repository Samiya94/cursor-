package com.interviewPlatform.repositories;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import com.interviewPlatform.entities.RefreshToken;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken,Long> {

    Optional<RefreshToken> findByToken(String token);

    @Transactional
    void deleteByUsername(String username);

}
