package com.craftcms.service;

import com.craftcms.model.AuditAction;
import com.craftcms.model.AuditLog;
import com.craftcms.model.User;
import com.craftcms.repository.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogService {

    private final AuditLogRepository repo;

    public void log(AuditAction action, User target, String details) {
        log(currentActor(), action, target, details);
    }

    public void log(User actor, AuditAction action, User target, String details) {
        if (actor == null) {
            // Should never happen for admin-gated routes, but if it does, don't
            // throw — log to slf4j and skip the DB row.
            log.warn("Audit log skipped: no actor in security context (action={}, target={})",
                    action, target != null ? target.getUsername() : null);
            return;
        }
        try {
            repo.save(AuditLog.builder()
                    .timestamp(LocalDateTime.now())
                    .actorId(actor.getId())
                    .actorUsername(actor.getUsername())
                    .action(action)
                    .targetId(target != null ? target.getId() : null)
                    .targetUsername(target != null ? target.getUsername() : null)
                    .details(details)
                    .ip(currentIp())
                    .build());
        } catch (Exception e) {
            // Never break the caller's transaction because of audit logging.
            log.error("Failed to persist audit log entry: {}", e.getMessage(), e);
        }
    }

    private User currentActor() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User u) return u;
        return null;
    }

    private String currentIp() {
        try {
            var attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs == null) return null;
            HttpServletRequest req = attrs.getRequest();
            String fwd = req.getHeader("X-Forwarded-For");
            if (fwd != null && !fwd.isBlank()) {
                // First IP in the chain is the original client.
                return fwd.split(",")[0].trim();
            }
            return req.getRemoteAddr();
        } catch (Exception ignored) {
            return null;
        }
    }
}
