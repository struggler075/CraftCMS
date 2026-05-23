package com.craftcms.controller;

import com.craftcms.dto.TopUpOrderDto;
import com.craftcms.model.PaymentSettings;
import com.craftcms.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/payments")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminPaymentController {

    private final PaymentService paymentService;

    @GetMapping("/settings")
    public ResponseEntity<PaymentSettings> getSettings() {
        PaymentSettings s = paymentService.getSettings();
        // Mask secret keys in response
        return ResponseEntity.ok(maskSecrets(s));
    }

    @PutMapping("/settings")
    public ResponseEntity<PaymentSettings> updateSettings(@RequestBody PaymentSettings body) {
        PaymentSettings updated = paymentService.updateSettings(body);
        return ResponseEntity.ok(maskSecrets(updated));
    }

    @GetMapping("/orders")
    public ResponseEntity<Page<TopUpOrderDto>> getOrders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<TopUpOrderDto> result = paymentService.getAllOrders(PageRequest.of(page, size))
                .map(TopUpOrderDto::from);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/orders/{orderId}/complete")
    public ResponseEntity<Map<String, String>> completeOrder(@PathVariable String orderId) {
        paymentService.completeOrder(orderId);
        return ResponseEntity.ok(Map.of("message", "Order completed"));
    }

    private PaymentSettings maskSecrets(PaymentSettings s) {
        PaymentSettings masked = new PaymentSettings();
        masked.setId(s.getId());
        masked.setTopUpProvider(s.getTopUpProvider());
        masked.setShowLogosInFooter(s.isShowLogosInFooter());

        masked.setFreekassaEnabled(s.isFreekassaEnabled());
        masked.setFreekassaMerchantId(s.getFreekassaMerchantId());
        masked.setFreekassaSecretKey1(mask(s.getFreekassaSecretKey1()));
        masked.setFreekassaSecretKey2(mask(s.getFreekassaSecretKey2()));

        masked.setUnitpayEnabled(s.isUnitpayEnabled());
        masked.setUnitpayPublicKey(s.getUnitpayPublicKey());
        masked.setUnitpaySecretKey(mask(s.getUnitpaySecretKey()));

        masked.setStripeEnabled(s.isStripeEnabled());
        masked.setStripePublishableKey(s.getStripePublishableKey());
        masked.setStripeSecretKey(mask(s.getStripeSecretKey()));
        masked.setStripeWebhookSecret(mask(s.getStripeWebhookSecret()));

        masked.setYookassaEnabled(s.isYookassaEnabled());
        masked.setYookassaShopId(s.getYookassaShopId());
        masked.setYookassaSecretKey(mask(s.getYookassaSecretKey()));

        masked.setTrademcEnabled(s.isTrademcEnabled());
        masked.setTrademcShopId(s.getTrademcShopId());
        masked.setTrademcItemId(s.getTrademcItemId());
        masked.setTrademcShopKey(mask(s.getTrademcShopKey()));

        return masked;
    }

    private String mask(String s) {
        if (s == null || s.isBlank()) return "";
        return "••••••••";
    }
}
