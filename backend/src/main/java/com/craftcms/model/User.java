package com.craftcms.model;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Role role = Role.USER;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal balance = BigDecimal.ZERO;

    private String skinUrl;
    private String capeUrl;

    @Builder.Default
    private boolean blocked = false;

    @Column(columnDefinition = "TEXT")
    private String blockReason;

    @Column(nullable = false, columnDefinition = "boolean default false")
    @Builder.Default
    private boolean emailVerified = false;

    private String totpSecret;

    @Builder.Default
    private boolean totpEnabled = false;

    // Incremented on any change that should invalidate live JWTs:
    // password reset, block/unblock, role change, "logout everywhere".
    @Column(nullable = false, columnDefinition = "bigint default 0")
    @Builder.Default
    private long tokenVersion = 0L;

    @Column(nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    // ── GravitLauncher SQL auth core ─────────────────────────────────────────
    //  Gravit's AbstractSQLCoreProvider issues unquoted SELECTs against the
    //  users table. Postgres lowercases every unquoted identifier, so columns
    //  MUST be physically named `uuid`, `accesstoken`, `serverid`, `hwidid`
    //  (no camelCase, no quotes). Each @Column(name=…) pins the wire-level
    //  name regardless of Hibernate's snake_case naming strategy.

    /**
     * RFC 4122 UUID, stored as fixed-width CHAR(36). Auto-generated on insert
     * via {@link #ensureUuid()} — no Postgres extension or trigger needed.
     */
    @Column(name = "uuid", unique = true, columnDefinition = "char(36)")
    private String uuid;

    @Column(name = "accesstoken", columnDefinition = "char(32)")
    private String accessToken;

    @Column(name = "serverid", length = 41)
    private String serverID;

    /**
     * FK to {@code hwids.id}. Declared as a plain Long so neither Spring Boot
     * nor the Gravit lookup path has to materialise the {@link Hwid} graph
     * for every user load — Gravit selects this column raw.
     */
    @Column(name = "hwidid")
    private Long hwidid;

    @PrePersist
    void ensureUuid() {
        if (uuid == null || uuid.isBlank()) {
            uuid = java.util.UUID.randomUUID().toString();
        }
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isAccountNonLocked() { return !blocked; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled() { return !blocked; }
}
