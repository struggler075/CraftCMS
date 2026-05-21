package com.craftcms.controller;

import com.craftcms.model.AuditAction;
import com.craftcms.model.AuditLog;
import com.craftcms.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
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
        String trimmed = (search == null || search.isBlank()) ? null : search.trim();
        return repo.search(action, actorId, targetId, from, to, trimmed,
                PageRequest.of(page, Math.min(size, 200))).map(AuditLogDto::from);
    }

    /** Lists every AuditAction enum value, so the UI dropdown doesn't have to hardcode them. */
    @GetMapping("/actions")
    public List<String> actions() {
        return Arrays.stream(AuditAction.values()).map(Enum::name).toList();
    }
}
