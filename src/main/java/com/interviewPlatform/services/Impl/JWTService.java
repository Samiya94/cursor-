package com.interviewPlatform.services.Impl;


import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;

@Service
public class JWTService {

    @Value("${jwt.secret}")
    private  String secretKey ;

    // public JWTService(){
    //     try {
    //         KeyGenerator keyGenerator= KeyGenerator.getInstance("HmacSHA256");
    //         SecretKey sk=keyGenerator.generateKey();
    //        secretKey= Base64.getEncoder().encodeToString(sk.getEncoded());
    //     } catch (NoSuchAlgorithmException e) {
    //         // TODO Auto-generated catch block
    //         e.printStackTrace();
    //     }
    // }

    // public String generateToken(String username) {

    //     Map<String, Object> claims=new HashMap<>();

    //     return Jwts.builder()
    //                 .claims()
    //                 .add(claims)
    //                 .subject(username)// sub is basically the username
    //                 .issuedAt(new Date(System.currentTimeMillis()))
    //                 .expiration(new Date(System.currentTimeMillis() +1000* 60 *60 *30))
    //                 .and()
    //                 .signWith(getKey())
    //                 .compact();
        
    // }

    public String generateAccessToken(String username) {

    return Jwts.builder()
            .subject(username)
            .claim("type", "access")
            .issuedAt(new Date(System.currentTimeMillis()))
            .expiration(new Date(System.currentTimeMillis() + 1000 * 60 * 15)) // 15 min
            .signWith(getKey())
            .compact();
}

public String generateRefreshToken(String username) {

    return Jwts.builder()
            .subject(username)
            .claim("type", "refresh")
            .issuedAt(new Date(System.currentTimeMillis()))
            .expiration(new Date(System.currentTimeMillis() + 1000 * 60 * 60 * 24 * 7)) // 7 days
            .signWith(getKey())
            .compact();
}

public boolean validateRefreshToken(String token) {
    try {
        return isRefreshToken(token) && !isTokenExpired(token);
    } catch (Exception e) {
        return false;
    }
}
    private SecretKey getKey() {

        // byte[] keyBytes=Decoders.BASE64.decode(secretKey);

        byte[] keyBytes = secretKey.getBytes();
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String extractUserName(String token) {
        //extract the username from the jwt token
        return extractClaim(token, Claims ::getSubject);

    }

    private<T> T extractClaim(String token, Function<Claims , T> claimResolver){
        final Claims claims=extractAllClaims(token);
        return claimResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
         try {
            return Jwts.parser()
                    .verifyWith(getKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (Exception e) {
            throw new RuntimeException("Invalid JWT token");
        }   
    }

    public boolean validateToken(String token, UserDetails userDetails) {
        final String userName= extractUserName(token);
        return (userName.equals(userDetails.getUsername()) && !isTokenExpired(token));
    }

    public boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public boolean isRefreshToken(String token) {
    return extractClaim(token, claims -> claims.get("type", String.class)).equals("refresh");
}



}