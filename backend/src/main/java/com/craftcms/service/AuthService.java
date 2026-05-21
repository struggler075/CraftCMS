package com.craftcms.service;

import com.craftcms.dto.AuthRequest;
import com.craftcms.dto.AuthResponse;
import com.craftcms.dto.RegisterRequest;
import com.craftcms.model.EmailVerificationToken;
import com.craftcms.model.PasswordResetToken;
import com.craftcms.model.Role;
import com.craftcms.model.SiteSettings;
import com.craftcms.model.User;
import com.craftcms.repository.EmailVerificationTokenRepository;
import com.craftcms.repository.PasswordResetTokenRepository;
import com.craftcms.repository.UserRepository;
import jakarta.persistence.EntityManager;
import com.craftcms.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthenticationManager authenticationManager;
    private final SiteSettingsService siteSettingsService;
    private final EmailVerificationTokenRepository tokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailService emailService;
    private final TotpService totpService;
    private final EntityManager entityManager;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Логин уже занят");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email уже зарегистрирован");
        }

        SiteSettings settings = siteSettingsService.get();

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(Role.USER)
                .balance(BigDecimal.ZERO)
                .emailVerified(false)
                .build();

        user = userRepository.save(user);

        // Send verification email if SMTP is configured — purely optional,
        // confirming it later only unlocks password recovery.
        boolean emailSent = sendVerificationEmail(user, settings);

        String token = jwtTokenProvider.generateToken(user);
        return AuthResponse.builder()
                .token(token)
                .username(user.getUsername())
                .email(user.getEmail())
                .role(user.getRole().name())
                .balance(user.getBalance())
                .requiresVerification(emailSent)
                .message("Регистрация прошла успешно")
                .build();
    }

    @Transactional
    public void resendVerification(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("Пользователь не найден"));
        if (user.isEmailVerified()) {
            throw new IllegalStateException("Email уже подтверждён");
        }
        if (!emailService.isSmtpEnabled()) {
            throw new IllegalStateException("SMTP не настроен. Обратитесь к администратору сервера.");
        }
        SiteSettings settings = siteSettingsService.get();
        sendVerificationEmail(user, settings);
    }

    private boolean sendVerificationEmail(User user, SiteSettings settings) {
        if (!emailService.isSmtpEnabled()) return false;
        tokenRepository.deleteByUserId(user.getId());
        entityManager.flush();
        String tokenStr = UUID.randomUUID().toString();
        tokenRepository.save(EmailVerificationToken.builder()
                .token(tokenStr)
                .user(user)
                .expiresAt(LocalDateTime.now().plusHours(24))
                .build());
        String baseUrl = settings.getSiteUrl() != null ? settings.getSiteUrl() : "http://localhost:5173";
        return emailService.sendVerificationEmail(user.getEmail(), user.getUsername(), tokenStr, baseUrl);
    }

    public AuthResponse login(AuthRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );

        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        ensureAccountUsable(user);

        // 2FA check
        if (user.isTotpEnabled()) {
            String preAuthToken = jwtTokenProvider.generatePreAuthToken(user);
            return AuthResponse.builder()
                    .requiresTOTP(true)
                    .preAuthToken(preAuthToken)
                    .message("Требуется код двухфакторной аутентификации")
                    .build();
        }

        return issueSession(user);
    }

    public AuthResponse verifyTotp(String preAuthToken, String code) {
        Long userId;
        try {
            userId = jwtTokenProvider.extractPreAuthUserId(preAuthToken);
        } catch (Exception e) {
            throw new IllegalArgumentException("Недействительный или истёкший токен. Войдите заново.");
        }
        if (userId == null) throw new IllegalArgumentException("Недействительный токен. Войдите заново.");

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UsernameNotFoundException("Пользователь не найден"));

        ensureAccountUsable(user);

        if (!totpService.verifyCode(user.getTotpSecret(), code)) {
            throw new IllegalArgumentException("Неверный код. Попробуйте снова.");
        }

        return issueSession(user);
    }

    private void ensureAccountUsable(User user) {
        if (user.isBlocked()) {
            String reason = user.getBlockReason();
            throw new LockedException("Аккаунт заблокирован" + (reason != null && !reason.isBlank() ? ": " + reason : ""));
        }
        // Email verification is OPTIONAL — it gates password recovery only
        // (see forgotPassword below), never login.
    }

    private AuthResponse issueSession(User user) {
        String token = jwtTokenProvider.generateToken(user);
        return AuthResponse.builder()
                .token(token)
                .username(user.getUsername())
                .email(user.getEmail())
                .role(user.getRole().name())
                .balance(user.getBalance())
                .message("Добро пожаловать!")
                .build();
    }

    /**
     * Invalidates every JWT ever issued for this user. Used by:
     *  - admin password reset / role change / block
     *  - self-service password reset
     *  - "logout everywhere" endpoint
     */
    @Transactional
    public void bumpTokenVersion(Long userId) {
        userRepository.findById(userId).ifPresent(u -> {
            u.setTokenVersion(u.getTokenVersion() + 1);
            userRepository.save(u);
        });
    }

    @Transactional
    public void forgotPassword(String email) {
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) return;

        if (!user.isEmailVerified()) {
            throw new IllegalStateException("Сначала подтвердите email. Ссылка для подтверждения была отправлена при регистрации.");
        }

        SiteSettings settings = siteSettingsService.get();
        passwordResetTokenRepository.deleteByUserId(user.getId());

        String tokenStr = UUID.randomUUID().toString();
        passwordResetTokenRepository.save(PasswordResetToken.builder()
                .token(tokenStr)
                .user(user)
                .expiresAt(LocalDateTime.now().plusHours(1))
                .build());

        String baseUrl = settings.getSiteUrl() != null ? settings.getSiteUrl() : "http://localhost:5173";
        emailService.sendPasswordResetEmail(user.getEmail(), user.getUsername(), tokenStr, baseUrl);
    }

    @Transactional
    public void resetPassword(String tokenStr, String newPassword) {
        PasswordResetToken token = passwordResetTokenRepository.findByToken(tokenStr)
                .orElseThrow(() -> new IllegalArgumentException("Ссылка недействительна или уже использована."));
        if (token.getExpiresAt().isBefore(LocalDateTime.now())) {
            passwordResetTokenRepository.delete(token);
            throw new IllegalArgumentException("Ссылка истекла. Запросите сброс пароля повторно.");
        }
        User user = token.getUser();
        user.setPassword(passwordEncoder.encode(newPassword));
        // Password rotated → kill every existing session for this account.
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);
        passwordResetTokenRepository.delete(token);
    }

    @Transactional
    public Map<String, Object> verifyEmail(String tokenStr) {
        EmailVerificationToken token = tokenRepository.findByToken(tokenStr)
                .orElseThrow(() -> new IllegalArgumentException("Недействительная или уже использованная ссылка"));

        if (token.getExpiresAt().isBefore(LocalDateTime.now())) {
            tokenRepository.delete(token);
            throw new IllegalArgumentException("Ссылка истекла. Зарегистрируйтесь повторно.");
        }

        User user = token.getUser();
        user.setEmailVerified(true);
        userRepository.save(user);
        tokenRepository.delete(token);

        return Map.of(
                "success", true,
                "message", "Email успешно подтверждён!",
                "username", user.getUsername()
        );
    }
}
