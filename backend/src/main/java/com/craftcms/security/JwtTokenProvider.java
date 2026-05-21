package com.craftcms.security;

import com.craftcms.model.User;
import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

@Component
@Slf4j
public class JwtTokenProvider {

    public static final String CLAIM_USERNAME = "uname";
    public static final String CLAIM_TOKEN_VERSION = "tv";
    public static final String CLAIM_PRE_AUTH = "pre_auth";

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${app.jwt.expiration}")
    private long jwtExpiration;

    public String generateToken(User user) {
        return Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .claim(CLAIM_USERNAME, user.getUsername())
                .claim(CLAIM_TOKEN_VERSION, user.getTokenVersion())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + jwtExpiration))
                .signWith(getSigningKey())
                .compact();
    }

    /** Short-lived token issued after password check when 2FA is required. */
    public String generatePreAuthToken(User user) {
        return Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .claim(CLAIM_USERNAME, user.getUsername())
                .claim(CLAIM_PRE_AUTH, true)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 5 * 60 * 1000)) // 5 min
                .signWith(getSigningKey())
                .compact();
    }

    /** Returns userId only if token is a valid pre-auth token, else throws. */
    public Long extractPreAuthUserId(String token) {
        Claims claims = parseClaims(token);
        if (!Boolean.TRUE.equals(claims.get(CLAIM_PRE_AUTH, Boolean.class))) {
            throw new IllegalArgumentException("Not a pre-auth token");
        }
        return parseLongSubject(claims);
    }

    public Long extractUserId(String token) {
        return parseLongSubject(parseClaims(token));
    }

    public String extractUsernameClaim(String token) {
        return parseClaims(token).get(CLAIM_USERNAME, String.class);
    }

    public Long extractTokenVersion(String token) {
        Number tv = parseClaims(token).get(CLAIM_TOKEN_VERSION, Number.class);
        return tv == null ? null : tv.longValue();
    }

    /**
     * Full validation against the current state of a persisted User.
     * Returns true only when the token's identity, version and username all match
     * the live DB row, the user is not blocked and the token is not expired.
     */
    public boolean validateToken(String token, User user) {
        try {
            Claims claims = parseClaims(token);
            if (claims.getExpiration() == null || claims.getExpiration().before(new Date())) return false;
            if (Boolean.TRUE.equals(claims.get(CLAIM_PRE_AUTH, Boolean.class))) return false;

            Long uid = parseLongSubject(claims);
            if (uid == null || !uid.equals(user.getId())) return false;

            Number tv = claims.get(CLAIM_TOKEN_VERSION, Number.class);
            if (tv == null || tv.longValue() != user.getTokenVersion()) return false;

            String uname = claims.get(CLAIM_USERNAME, String.class);
            // Username embedded in the token must still match the current row —
            // protects against handing a stale token to a renamed/recreated account.
            if (uname == null || !uname.equals(user.getUsername())) return false;

            return !user.isBlocked();
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("JWT validation failed: {}", e.getMessage());
            return false;
        }
    }

    public boolean isTokenParsable(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private Long parseLongSubject(Claims claims) {
        try {
            return Long.parseLong(claims.getSubject());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private SecretKey getSigningKey() {
        byte[] keyBytes = Decoders.BASE64.decode(jwtSecret);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
