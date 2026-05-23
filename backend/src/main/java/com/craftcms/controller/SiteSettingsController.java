package com.craftcms.controller;

import com.craftcms.model.PaymentSettings;
import com.craftcms.model.SiteSettings;
import com.craftcms.service.PaymentService;
import com.craftcms.service.SiteSettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
public class SiteSettingsController {

    private final SiteSettingsService service;
    private final PaymentService paymentService;

    @Value("${app.modules.trademc:true}")
    private boolean trademcModuleEnabled;

    @GetMapping("/api/settings")
    public ResponseEntity<SiteSettings> get() {
        return ResponseEntity.ok(service.get());
    }

    @PutMapping("/api/admin/settings")
    public ResponseEntity<SiteSettings> update(@RequestBody SiteSettings settings) {
        return ResponseEntity.ok(service.update(settings));
    }

    @GetMapping("/api/settings/payment-logos")
    public ResponseEntity<Map<String, Object>> paymentLogos() {
        PaymentSettings ps = paymentService.getSettings();
        return ResponseEntity.ok(Map.of(
                "show",          ps.isShowLogosInFooter(),
                "freekassa",     ps.isFreekassaEnabled(),
                "unitpay",       ps.isUnitpayEnabled(),
                "stripe",        ps.isStripeEnabled(),
                "yookassa",      ps.isYookassaEnabled(),
                "trademc",       trademcModuleEnabled && ps.isTrademcEnabled(),
                "topUpProvider", ps.getTopUpProvider() != null ? ps.getTopUpProvider() : ""
        ));
    }

    @GetMapping("/api/settings/modules")
    public ResponseEntity<Map<String, Boolean>> modules() {
        return ResponseEntity.ok(Map.of(
                "trademc", trademcModuleEnabled
        ));
    }
}
