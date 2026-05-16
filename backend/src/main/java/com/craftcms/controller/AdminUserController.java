package com.craftcms.controller;

import com.craftcms.model.Role;
import com.craftcms.model.User;
import com.craftcms.repository.EmailVerificationTokenRepository;
import com.craftcms.repository.UserRepository;
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
        if (req.role() != null) u.setRole(Role.valueOf(req.role()));
        if (req.balance() != null) u.setBalance(req.balance());
        if (req.blocked() != null) u.setBlocked(req.blocked());
        if (req.blockReason() != null) u.setBlockReason(req.blockReason().isBlank() ? null : req.blockReason());
        if (req.newPassword() != null && !req.newPassword().isBlank())
            u.setPassword(passwordEncoder.encode(req.newPassword()));
        return toDto(userRepository.save(u));
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    @Transactional
    public void delete(@PathVariable Long id) {
        emailVerificationTokenRepository.deleteByUserId(id);
        userRepository.deleteById(id);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private UserDto toDto(User u) {
        return new UserDto(u.getId(), u.getUsername(), u.getEmail(),
                u.getRole().name(), u.getBalance(), u.isBlocked(), u.getSkinUrl(), u.getCreatedAt());
    }
}
