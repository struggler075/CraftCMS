package com.craftcms.controller;

import com.craftcms.model.User;
import com.craftcms.repository.UserRepository;
import com.craftcms.service.SiteSettingsService;
import com.craftcms.service.TotpService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/user/2fa")
@RequiredArgsConstructor
public class UserTotpController {

    private final TotpService totpService;
    private final UserRepository userRepository;
    private final SiteSettingsService siteSettingsService;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status(
            @AuthenticationPrincipal UserDetails principal) {
        User user = getUser(principal);
        return ResponseEntity.ok(Map.of("enabled", user.isTotpEnabled()));
    }

    /** Generate a new secret and return the QR code URL (does not save yet). */
    @PostMapping("/setup")
    public ResponseEntity<Map<String, String>> setup(
            @AuthenticationPrincipal UserDetails principal) {
        User user = getUser(principal);
        String secret = totpService.generateSecret();
        // Temporarily store secret on user so /enable can use it
        user.setTotpSecret(secret);
        user.setTotpEnabled(false);
        userRepository.save(user);

        String siteName = siteSettingsService.get().getSiteName();
        String otpUrl = totpService.getOtpAuthUrl(secret, user.getUsername(), siteName);
        return ResponseEntity.ok(Map.of("secret", secret, "otpUrl", otpUrl));
    }

    /** Verify code then activate 2FA. */
    @PostMapping("/enable")
    public ResponseEntity<Map<String, String>> enable(
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody Map<String, String> body) {
        User user = getUser(principal);
        if (user.getTotpSecret() == null)
            throw new IllegalStateException("Сначала вызовите /setup");
        if (!totpService.verifyCode(user.getTotpSecret(), body.get("code")))
            throw new IllegalArgumentException("Неверный код. Попробуйте снова.");
        user.setTotpEnabled(true);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Двухфакторная аутентификация включена"));
    }

    /** Verify current code then deactivate 2FA. */
    @PostMapping("/disable")
    public ResponseEntity<Map<String, String>> disable(
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody Map<String, String> body) {
        User user = getUser(principal);
        if (!user.isTotpEnabled())
            throw new IllegalStateException("2FA не включена");
        if (!totpService.verifyCode(user.getTotpSecret(), body.get("code")))
            throw new IllegalArgumentException("Неверный код. Попробуйте снова.");
        user.setTotpEnabled(false);
        user.setTotpSecret(null);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Двухфакторная аутентификация отключена"));
    }

    private User getUser(UserDetails principal) {
        return userRepository.findByUsername(principal.getUsername())
                .orElseThrow(() -> new RuntimeException("Пользователь не найден"));
    }
}
