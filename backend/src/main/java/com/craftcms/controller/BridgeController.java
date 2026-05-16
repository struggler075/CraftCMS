package com.craftcms.controller;

import com.craftcms.dto.CartItemDto;
import com.craftcms.model.DonateOrder;
import com.craftcms.model.Order;
import com.craftcms.model.SiteSettings;
import com.craftcms.model.User;
import com.craftcms.repository.DonateOrderRepository;
import com.craftcms.repository.OrderRepository;
import com.craftcms.repository.UserRepository;
import com.craftcms.service.SiteSettingsService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bridge")
@RequiredArgsConstructor
public class BridgeController {

    private final SiteSettingsService siteSettingsService;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final DonateOrderRepository donateOrderRepository;

    private void validateKey(HttpServletRequest req) {
        SiteSettings s = siteSettingsService.get();
        String key = req.getHeader("X-Bridge-Key");
        if (key == null || !key.equals(s.getBridgeApiKey())) {
            throw new IllegalStateException("Invalid bridge API key");
        }
        // Optional IP whitelist
        String allowedIp = s.getBridgeAllowedIp();
        if (allowedIp != null && !allowedIp.isBlank()) {
            String remoteIp = getRemoteIp(req);
            if (!allowedIp.equals(remoteIp)) {
                throw new IllegalStateException("Request IP not in whitelist: " + remoteIp);
            }
        }
    }

    private String getRemoteIp(HttpServletRequest req) {
        String forwarded = req.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }

    // ── Ping ───────────────────────────────────────────────────────────────────

    @GetMapping("/ping")
    public ResponseEntity<Map<String, String>> ping() {
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    // ── Ban check ──────────────────────────────────────────────────────────────

    @GetMapping("/player/{username}/status")
    public ResponseEntity<Map<String, Object>> getStatus(
            @PathVariable String username, HttpServletRequest req) {
        validateKey(req);
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ResponseEntity.ok(Map.of("blocked", false, "exists", false));
        }
        if (user.isBlocked()) {
            SiteSettings s = siteSettingsService.get();
            String reason = user.getBlockReason() != null ? user.getBlockReason() : "Нарушение правил";
            String msg = s.getBanKickMessage().replace("{reason}", reason);
            return ResponseEntity.ok(Map.of("blocked", true, "exists", true, "kickMessage", msg));
        }
        return ResponseEntity.ok(Map.of("blocked", false, "exists", true));
    }

    // ── Cart ───────────────────────────────────────────────────────────────────

    @GetMapping("/player/{username}/cart")
    public ResponseEntity<List<CartItemDto>> getCart(
            @PathVariable String username, HttpServletRequest req) {
        validateKey(req);
        List<CartItemDto> items = new ArrayList<>();

        orderRepository.findByUserUsernameAndClaimedFalseOrderByCreatedAtAsc(username)
                .forEach(o -> items.add(CartItemDto.builder()
                        .id(o.getId())
                        .type("PRODUCT")
                        .productType(o.getProduct().getType().name())
                        .name(o.getProduct().getName())
                        .quantity(o.getQuantity())
                        .command(o.getProduct().getCommand())
                        .build()));

        donateOrderRepository.findByUserUsernameAndClaimedFalseOrderByCreatedAtAsc(username)
                .forEach(d -> items.add(CartItemDto.builder()
                        .id(d.getId())
                        .type("DONATE")
                        .productType("RANK")
                        .name(d.getRank().getName())
                        .quantity(1)
                        .command(d.getRank().getCommand())
                        .build()));

        return ResponseEntity.ok(items);
    }

    // ── Claim ──────────────────────────────────────────────────────────────────

    @PostMapping("/player/{username}/cart/claim/{type}/{orderId}")
    @Transactional
    public ResponseEntity<Map<String, String>> claimItem(
            @PathVariable String username,
            @PathVariable String type,
            @PathVariable Long orderId,
            HttpServletRequest req) {
        validateKey(req);

        String command;
        String name;
        int quantity;

        if ("PRODUCT".equalsIgnoreCase(type)) {
            Order order = orderRepository.findById(orderId)
                    .orElseThrow(() -> new IllegalArgumentException("Order not found"));
            if (!order.getUser().getUsername().equals(username))
                throw new IllegalStateException("Forbidden");
            if (order.isClaimed())
                return ResponseEntity.badRequest().body(Map.of("error", "Already claimed"));
            order.setClaimed(true);
            orderRepository.save(order);
            command = order.getProduct().getCommand();
            name = order.getProduct().getName();
            quantity = order.getQuantity();
        } else if ("DONATE".equalsIgnoreCase(type)) {
            DonateOrder d = donateOrderRepository.findById(orderId)
                    .orElseThrow(() -> new IllegalArgumentException("Donate order not found"));
            if (!d.getUser().getUsername().equals(username))
                throw new IllegalStateException("Forbidden");
            if (d.isClaimed())
                return ResponseEntity.badRequest().body(Map.of("error", "Already claimed"));
            d.setClaimed(true);
            donateOrderRepository.save(d);
            command = d.getRank().getCommand();
            name = d.getRank().getName();
            quantity = 1;
        } else {
            throw new IllegalArgumentException("Unknown type: " + type);
        }

        String finalCommand = "";
        if (command != null && !command.isBlank()) {
            finalCommand = command
                    .replace("{username}", username)
                    .replace("{amount}", String.valueOf(quantity));
        }

        return ResponseEntity.ok(Map.of("command", finalCommand, "name", name));
    }
}
