package com.craftcms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs", indexes = {
        @Index(name = "idx_audit_timestamp", columnList = "timestamp"),
        @Index(name = "idx_audit_actor_id", columnList = "actorId"),
        @Index(name = "idx_audit_target_id", columnList = "targetId"),
        @Index(name = "idx_audit_action", columnList = "action"),
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();

    /** Admin who performed the action — id is denormalised so logs survive user deletion. */
    @Column(nullable = false)
    private Long actorId;

    @Column(nullable = false, length = 64)
    private String actorUsername;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 64)
    private AuditAction action;

    /** Affected user — denormalised for the same reason as actor. May be null for non-user actions. */
    private Long targetId;

    @Column(length = 64)
    private String targetUsername;

    /** Free-form human-readable summary (e.g. "balance 100 → 250", "role USER → ADMIN", "reason: cheating"). */
    @Column(columnDefinition = "TEXT")
    private String details;

    @Column(length = 64)
    private String ip;
}
