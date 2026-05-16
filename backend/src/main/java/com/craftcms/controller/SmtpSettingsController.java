package com.craftcms.controller;

import com.craftcms.model.SmtpSettings;
import com.craftcms.service.EmailService;
import com.craftcms.service.SmtpSettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/smtp")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class SmtpSettingsController {

    private final SmtpSettingsService service;
    private final EmailService emailService;

    @GetMapping
    public ResponseEntity<SmtpSettings> get() {
        return ResponseEntity.ok(service.get());
    }

    @PutMapping
    public ResponseEntity<SmtpSettings> update(@RequestBody SmtpSettings settings) {
        return ResponseEntity.ok(service.update(settings));
    }

    @PostMapping("/test")
    public ResponseEntity<Map<String, String>> test(@RequestBody Map<String, String> body) {
        String to = body.get("email");
        if (to == null || to.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email обязателен"));
        }
        emailService.sendVerificationEmail(to, "TestUser", "test-token-000", "http://localhost:5173");
        return ResponseEntity.ok(Map.of("message", "Тестовое письмо отправлено на " + to));
    }
}
