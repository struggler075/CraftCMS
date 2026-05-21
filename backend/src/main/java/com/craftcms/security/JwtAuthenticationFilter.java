package com.craftcms.security;

import com.craftcms.model.User;
import com.craftcms.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String token = extractTokenFromRequest(request);

        if (StringUtils.hasText(token) && jwtTokenProvider.isTokenParsable(token)) {
            try {
                Long userId = jwtTokenProvider.extractUserId(token);
                if (userId == null) {
                    // Legacy or malformed token — treat as anonymous.
                    SecurityContextHolder.clearContext();
                } else {
                    Optional<User> userOpt = userRepository.findById(userId);
                    if (userOpt.isEmpty()) {
                        // The account behind this token no longer exists.
                        SecurityContextHolder.clearContext();
                    } else {
                        User user = userOpt.get();
                        if (jwtTokenProvider.validateToken(token, user)) {
                            UsernamePasswordAuthenticationToken authToken =
                                    new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
                            authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                            SecurityContextHolder.getContext().setAuthentication(authToken);
                        } else {
                            // Identity bound to the token diverged from the live DB row
                            // (renamed, blocked, password rotated, tokenVersion bumped, expired…).
                            SecurityContextHolder.clearContext();
                        }
                    }
                }
            } catch (Exception e) {
                log.debug("JWT auth failed: {}", e.getMessage());
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }

    private String extractTokenFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
