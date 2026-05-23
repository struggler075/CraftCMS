package com.craftcms.controller;

import com.craftcms.dto.TopUpOrderDto;
import com.craftcms.service.PaymentService;
import com.craftcms.service.SiteSettingsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import com.craftcms.repository.UserRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
@Slf4j
public class PaymentController {

    private final PaymentService paymentService;
    private final SiteSettingsService settingsService;
    private final UserRepository userRepository;

    // ── Create top-up (authenticated) ────────────────────────────────────────

    @PostMapping("/initiate")
    public ResponseEntity<Map<String, String>> initiate(
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody Map<String, Object> body) {
        BigDecimal amount = new BigDecimal(body.get("amount").toString());
        String siteUrl = settingsService.get().getSiteUrl();

        var user = userRepository.findByUsername(principal.getUsername()).orElseThrow();
        String redirectUrl = paymentService.createTopUp(user.getId(), amount, siteUrl);
        return ResponseEntity.ok(Map.of("redirectUrl", redirectUrl));
    }

    // ── User's own top-up history ────────────────────────────────────────────

    @GetMapping("/history")
    public ResponseEntity<List<TopUpOrderDto>> history(
            @AuthenticationPrincipal UserDetails principal) {
        var user = userRepository.findByUsername(principal.getUsername()).orElseThrow();
        List<TopUpOrderDto> dtos = paymentService.getUserOrders(user.getId())
                .stream().map(TopUpOrderDto::from).toList();
        return ResponseEntity.ok(dtos);
    }

    // ── FreeKassa webhook ────────────────────────────────────────────────────

    @PostMapping("/webhook/freekassa")
    public ResponseEntity<String> freekassaWebhook(@RequestParam Map<String, String> params) {
        String result = paymentService.handleFreekassaWebhook(
                params.get("MERCHANT_ID"),
                params.get("AMOUNT"),
                params.get("MERCHANT_ORDER_ID"),
                params.get("SIGN"),
                params.getOrDefault("CUR_ID", "RUB"));
        return ResponseEntity.ok(result);
    }

    // ── UnitPay webhook ──────────────────────────────────────────────────────

    @GetMapping("/webhook/unitpay")
    public ResponseEntity<Map<String, Object>> unitpayWebhook(
            @RequestParam String method,
            @RequestParam Map<String, String> allParams) {
        // UnitPay sends params[key] style, Spring maps them as "params[key]"
        Map<String, String> innerParams = new java.util.HashMap<>();
        allParams.forEach((k, v) -> {
            if (k.startsWith("params[") && k.endsWith("]")) {
                innerParams.put(k.substring(7, k.length() - 1), v);
            }
        });
        Map<String, Object> result = paymentService.handleUnitpayWebhook(method, innerParams);
        return ResponseEntity.ok(result);
    }

    // ── Stripe webhook ───────────────────────────────────────────────────────

    @PostMapping("/webhook/stripe")
    public ResponseEntity<String> stripeWebhook(
            @RequestBody String payload,
            @RequestHeader("Stripe-Signature") String sigHeader) {
        paymentService.handleStripeWebhook(payload, sigHeader);
        return ResponseEntity.ok("ok");
    }

    // ── YooKassa webhook ─────────────────────────────────────────────────────

    @PostMapping("/webhook/yookassa")
    public ResponseEntity<String> yookassaWebhook(@RequestBody String payload) {
        paymentService.handleYookassaWebhook(payload);
        return ResponseEntity.ok("ok");
    }

    // ── TradeMC webhook ─────────────────────────────────────────────────────
    // TradeMC sends Content-Type: application/x-www-form-urlencoded but the
    // body is actually JSON. Spring's FormHttpMessageConverter consumes the
    // InputStream to parse form params, leaving @RequestBody empty. So we
    // read the raw InputStream ourselves BEFORE Spring touches it by using
    // HttpServletRequest directly (no @RequestBody).

    @PostMapping(value = "/webhook/trademc")
    public ResponseEntity<String> tradeMcWebhook(jakarta.servlet.http.HttpServletRequest request) {
        try {
            String body = new String(request.getInputStream().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            log.info("TradeMC webhook: Content-Type={}, len={}", request.getContentType(), body.length());

            // If body is form-urlencoded (key=value&key2=value2), reconstruct JSON
            // from parameter map. If body looks like JSON already, use as-is.
            String jsonPayload;
            if (body.startsWith("{")) {
                jsonPayload = body;
            } else {
                // Form-encoded: rebuild JSON from request parameters.
                // TradeMC sends flat form fields, but we need the original JSON
                // structure for hash verification. Re-read from params.
                var params = request.getParameterMap();
                if (params != null && !params.isEmpty()) {
                    var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                    // Flatten: each param key → first value
                    var flat = new java.util.LinkedHashMap<String, Object>();
                    params.forEach((k, v) -> {
                        if (v != null && v.length > 0) flat.put(k, v.length == 1 ? v[0] : v);
                    });
                    jsonPayload = mapper.writeValueAsString(flat);
                } else {
                    // Last resort: URL-decode the whole body in case it's one big encoded JSON
                    jsonPayload = java.net.URLDecoder.decode(body, java.nio.charset.StandardCharsets.UTF_8);
                }
            }

            log.info("TradeMC webhook jsonPayload (len={}): {}", jsonPayload.length(),
                    jsonPayload.length() > 500 ? jsonPayload.substring(0, 500) : jsonPayload);

            String result = paymentService.handleTradeMcWebhook(jsonPayload);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("TradeMC webhook read error: {}", e.getMessage());
            return ResponseEntity.ok("read error");
        }
    }
}
