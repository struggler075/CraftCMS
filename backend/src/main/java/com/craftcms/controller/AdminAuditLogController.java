package com.craftcms.controller;

import com.craftcms.model.AuditAction;
import com.craftcms.model.AuditLog;
import com.craftcms.repository.AuditLogRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/admin/audit-logs")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminAuditLogController {

    private final AuditLogRepository repo;

    public record AuditLogDto(Long id,
                              LocalDateTime timestamp,
                              Long actorId,
                              String actorUsername,
                              AuditAction action,
                              Long targetId,
                              String targetUsername,
                              String details,
                              String ip) {
        static AuditLogDto from(AuditLog a) {
            return new AuditLogDto(a.getId(), a.getTimestamp(),
                    a.getActorId(), a.getActorUsername(),
                    a.getAction(),
                    a.getTargetId(), a.getTargetUsername(),
                    a.getDetails(), a.getIp());
        }
    }

    @GetMapping
    public Page<AuditLogDto> list(
            @RequestParam(required = false) AuditAction action,
            @RequestParam(required = false) Long actorId,
            @RequestParam(required = false) Long targetId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        String trimmed = (search == null || search.isBlank()) ? null : search.trim().toLowerCase();

        // Build the WHERE clause dynamically. JPQL's "(:param IS NULL OR …)" trick
        // breaks on PostgreSQL because Hibernate can't infer a type for the
        // untyped null literal — Specifications side-step that entirely.
        Specification<AuditLog> spec = (root, q, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (action   != null) ps.add(cb.equal(root.get("action"),   action));
            if (actorId  != null) ps.add(cb.equal(root.get("actorId"),  actorId));
            if (targetId != null) ps.add(cb.equal(root.get("targetId"), targetId));
            if (from     != null) ps.add(cb.greaterThanOrEqualTo(root.get("timestamp"), from));
            if (to       != null) ps.add(cb.lessThanOrEqualTo(root.get("timestamp"),    to));
            if (trimmed  != null) {
                String like = "%" + trimmed + "%";
                ps.add(cb.or(
                        cb.like(cb.lower(root.get("actorUsername")),  like),
                        cb.like(cb.lower(cb.coalesce(root.<String>get("targetUsername"), "")), like),
                        cb.like(cb.lower(cb.coalesce(root.<String>get("details"),        "")), like)
                ));
            }
            return ps.isEmpty() ? cb.conjunction() : cb.and(ps.toArray(new Predicate[0]));
        };

        PageRequest pageable = PageRequest.of(page, Math.min(size, 200), Sort.by(Sort.Direction.DESC, "timestamp"));
        return repo.findAll(spec, pageable).map(AuditLogDto::from);
    }

    /** Lists every AuditAction enum value, so the UI dropdown doesn't have to hardcode them. */
    @GetMapping("/actions")
    public List<String> actions() {
        return Arrays.stream(AuditAction.values()).map(Enum::name).toList();
    }
}
