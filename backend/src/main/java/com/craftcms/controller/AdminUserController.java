package com.craftcms.controller;

import com.craftcms.model.AuditAction;
import com.craftcms.model.Role;
import com.craftcms.model.User;
import com.craftcms.repository.EmailVerificationTokenRepository;
import com.craftcms.repository.UserRepository;
import com.craftcms.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminUserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final AuditLogService auditLog;

    record UserDto(Long id, String username, String email, String role,
                   BigDecimal balance, boolean blocked, String skinUrl, LocalDateTime createdAt) {}

    record UpdateRequest(String role, BigDecimal balance, String newPassword, Boolean blocked, String blockReason) {}

    record StatsDto(long total, long admins) {}

    // ── List ──────────────────────────────────────────────────────────────────

    @GetMapping
    public Page<UserDto> list(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<User> users = search.isBlank()
                ? userRepository.findAll(pageable)
                : userRepository.findByUsernameContainingIgnoreCaseOrEmailContainingIgnoreCase(search, search, pageable);
        return users.map(this::toDto);
    }

    @GetMapping("/stats")
    public StatsDto stats() {
        return new StatsDto(userRepository.count(), userRepository.countByRole(Role.ADMIN));
    }

    // ── Update ────────────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    public UserDto update(@PathVariable Long id, @RequestBody UpdateRequest req) {
        User u = userRepository.findById(id).orElseThrow();

        // Track whether anything security-sensitive changed — if so, every existing
        // JWT for this user must be invalidated.
        boolean securityChange = false;

        // Capture "before" state so audit logs can show clear deltas.
        Role oldRole = u.getRole();
        BigDecimal oldBalance = u.getBalance();
        boolean oldBlocked = u.isBlocked();

        if (req.role() != null) {
            Role newRole = Role.valueOf(req.role());
            if (oldRole != newRole) {
                u.setRole(newRole);
                securityChange = true;
                auditLog.log(AuditAction.USER_ROLE_CHANGE, u,
                        "роль " + oldRole + " → " + newRole);
            }
        }
        if (req.balance() != null && oldBalance.compareTo(req.balance()) != 0) {
            u.setBalance(req.balance());
            auditLog.log(AuditAction.USER_BALANCE_CHANGE, u,
                    "баланс " + oldBalance.toPlainString() + " → " + req.balance().toPlainString() + " ₽");
        }
        if (req.blocked() != null && req.blocked() != oldBlocked) {
            u.setBlocked(req.blocked());
            securityChange = true;
            String reason = (req.blockReason() != null && !req.blockReason().isBlank())
                    ? req.blockReason().trim()
                    : null;
            auditLog.log(req.blocked() ? AuditAction.USER_BLOCK : AuditAction.USER_UNBLOCK, u,
                    req.blocked() && reason != null ? "причина: " + reason : null);
        }
        if (req.blockReason() != null) u.setBlockReason(req.blockReason().isBlank() ? null : req.blockReason());
        if (req.newPassword() != null && !req.newPassword().isBlank()) {
            u.setPassword(passwordEncoder.encode(req.newPassword()));
            securityChange = true;
            auditLog.log(AuditAction.USER_PASSWORD_RESET, u, "пароль сброшен админом");
        }

        if (securityChange) u.setTokenVersion(u.getTokenVersion() + 1);

        return toDto(userRepository.save(u));
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    @Transactional
    public void delete(@PathVariable Long id) {
        // Log BEFORE the row disappears, otherwise targetUsername is lost.
        User u = userRepository.findById(id).orElseThrow();
        auditLog.log(AuditAction.USER_DELETE, u, "пользователь " + u.getUsername() + " (id=" + u.getId() + ") удалён");

        emailVerificationTokenRepository.deleteByUserId(id);
        userRepository.deleteById(id);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private UserDto toDto(User u) {
        return new UserDto(u.getId(), u.getUsername(), u.getEmail(),
                u.getRole().name(), u.getBalance(), u.isBlocked(), u.getSkinUrl(), u.getCreatedAt());
    }
}
