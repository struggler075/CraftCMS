package com.craftcms.controller;

import com.craftcms.dto.AuthRequest;
import com.craftcms.dto.AuthResponse;
import com.craftcms.dto.CurrentUserDto;
import com.craftcms.dto.RegisterRequest;
import com.craftcms.model.User;
import com.craftcms.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/verify-email")
    public ResponseEntity<Map<String, Object>> verifyEmail(@RequestParam String token) {
        return ResponseEntity.ok(authService.verifyEmail(token));
    }

    @PostMapping("/2fa/verify")
    public ResponseEntity<AuthResponse> verify2fa(@RequestBody Map<String, String> body) {
        String preAuthToken = body.get("preAuthToken");
        String code = body.get("code");
        if (preAuthToken == null || code == null)
            throw new IllegalArgumentException("Не указан токен или код");
        return ResponseEntity.ok(authService.verifyTotp(preAuthToken, code));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(@RequestBody Map<String, String> body) {
        authService.forgotPassword(body.getOrDefault("email", ""));
        return ResponseEntity.ok(Map.of("message", "Если аккаунт с таким email существует — письмо отправлено."));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(@RequestBody Map<String, String> body) {
        String token = body.get("token");
        String password = body.get("password");
        if (token == null || password == null || password.length() < 6)
            throw new IllegalArgumentException("Пароль должен содержать минимум 6 символов");
        authService.resetPassword(token, password);
        return ResponseEntity.ok(Map.of("message", "Пароль успешно изменён. Теперь вы можете войти."));
    }

    /**
     * Single source of truth for the SPA. Frontend calls this on every page load
     * to revalidate the persisted JWT against the live DB row. Any mismatch
     * (user deleted, blocked, renamed, password rotated, tokenVersion bumped, expired)
     * is rejected by the filter with 401 before this handler is ever reached.
     */
    @GetMapping("/me")
    public ResponseEntity<CurrentUserDto> me(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(CurrentUserDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .role(user.getRole().name())
                .balance(user.getBalance())
                .emailVerified(user.isEmailVerified())
                .blocked(user.isBlocked())
                .skinUrl(user.getSkinUrl())
                .capeUrl(user.getCapeUrl())
                .build());
    }

    /** Invalidates every JWT ever issued for this account by bumping tokenVersion. */
    @PostMapping("/logout-all")
    public ResponseEntity<Map<String, String>> logoutAll(@AuthenticationPrincipal User user) {
        authService.bumpTokenVersion(user.getId());
        return ResponseEntity.ok(Map.of("message", "Все сессии завершены."));
    }
}
