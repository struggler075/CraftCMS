package com.craftcms.controller;

import com.craftcms.service.WsTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Internal endpoints consumed by the craftcms-updater Elixir process.
 * Exposed via /api/internal/** which is permit-all in SecurityConfig
 * (the token itself is the authentication mechanism — single-use, 60s TTL).
 */
@RestController
@RequestMapping("/api/internal")
@RequiredArgsConstructor
public class InternalController {

    private final WsTokenService wsTokenService;

    @GetMapping("/ws-token-valid")
    public ResponseEntity<Map<String, String>> validateWsToken(@RequestParam("t") String token) {
        return wsTokenService.consume(token)
                .map(githubToken -> ResponseEntity.ok(Map.of("githubToken", githubToken)))
                .orElseGet(() -> ResponseEntity.status(401)
                        .body(Map.of("error", "invalid or expired token")));
    }
}
