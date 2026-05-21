package com.craftcms.controller;

import com.craftcms.dto.CartItemDto;
import com.craftcms.model.DonateOrder;
import com.craftcms.model.DonateRank;
import com.craftcms.model.MinecraftServer;
import com.craftcms.model.Order;
import com.craftcms.model.Product;
import com.craftcms.model.SiteSettings;
import com.craftcms.model.User;
import com.craftcms.repository.DonateOrderRepository;
import com.craftcms.repository.MinecraftServerRepository;
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
    private final MinecraftServerRepository serverRepository;

    /**
     * Identifies which Minecraft server the request came from by matching the
     * X-Bridge-Key header against MinecraftServer.bridgeApiKey. Falls back to
     * the global SiteSettings.bridgeApiKey for legacy single-server installs
     * (returns null — meaning "no specific server, show everything").
     *
     * Throws if the key is missing/invalid or the source IP doesn't match the
     * configured whitelist.
     */
    private MinecraftServer identifyServer(HttpServletRequest req) {
        String key = req.getHeader("X-Bridge-Key");
        if (key == null || key.isBlank()) {
            throw new IllegalStateException("Missing X-Bridge-Key header");
        }

        // First — try per-server keys (modern multi-server mode).
        MinecraftServer server = serverRepository.findByBridgeApiKey(key).orElse(null);

        SiteSettings settings = siteSettingsService.get();

        if (server == null) {
            // Fall back to the legacy global key — this keeps existing single-server
            // installs working without forcing a migration. Returning null here
            // means "no specific server identified, show every order".
            String globalKey = settings.getBridgeApiKey();
            if (globalKey == null || !globalKey.equals(key)) {
                throw new IllegalStateException("Invalid bridge API key");
            }
        }

        // Optional IP whitelist applies in both modes.
        String allowedIp = settings.getBridgeAllowedIp();
        if (allowedIp != null && !allowedIp.isBlank()) {
            String remoteIp = getRemoteIp(req);
            if (!allowedIp.equals(remoteIp)) {
                throw new IllegalStateException("Request IP not in whitelist: " + remoteIp);
            }
        }

        return server;
    }

    private String getRemoteIp(HttpServletRequest req) {
        String forwarded = req.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }

    /**
     * Per-server orders are only visible to the server they target. A NULL
     * server on the product/rank means "global" — visible everywhere (so an
     * admin can sell e.g. a currency item that should drop on any world).
     * Legacy single-server mode (callerServer == null) sees every order.
     */
    private boolean visibleToCaller(MinecraftServer callerServer, MinecraftServer targetServer) {
        if (callerServer == null) return true;          // legacy global mode
        if (targetServer == null) return true;          // product/rank is global
        return targetServer.getId().equals(callerServer.getId());
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
        identifyServer(req);
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
        MinecraftServer callerServer = identifyServer(req);
        List<CartItemDto> items = new ArrayList<>();

        orderRepository.findByUserUsernameAndClaimedFalseOrderByCreatedAtAsc(username)
                .stream()
                .filter(o -> visibleToCaller(callerServer, o.getProduct().getServer()))
                .forEach(o -> items.add(CartItemDto.builder()
                        .id(o.getId())
                        .type("PRODUCT")
                        .productType(o.getProduct().getType().name())
                        .name(o.getProduct().getName())
                        .quantity(o.getQuantity())
                        .command(o.getProduct().getCommand())
                        .build()));

        donateOrderRepository.findByUserUsernameAndClaimedFalseOrderByCreatedAtAsc(username)
                .stream()
                .filter(d -> visibleToCaller(callerServer, d.getRank().getServer()))
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
        MinecraftServer callerServer = identifyServer(req);

        String command;
        String name;
        int quantity;

        if ("PRODUCT".equalsIgnoreCase(type)) {
            Order order = orderRepository.findById(orderId)
                    .orElseThrow(() -> new IllegalArgumentException("Order not found"));
            if (!order.getUser().getUsername().equals(username))
                throw new IllegalStateException("Forbidden");

            // Reject claim if this server isn't the one the product is tied to.
            // Without this any plugin could steal another server's orders.
            Product product = order.getProduct();
            if (!visibleToCaller(callerServer, product.getServer())) {
                throw new IllegalStateException(
                        "Order belongs to a different Minecraft server");
            }

            if (order.isClaimed())
                return ResponseEntity.badRequest().body(Map.of("error", "Already claimed"));
            order.setClaimed(true);
            orderRepository.save(order);
            command = product.getCommand();
            name = product.getName();
            quantity = order.getQuantity();
        } else if ("DONATE".equalsIgnoreCase(type)) {
            DonateOrder d = donateOrderRepository.findById(orderId)
                    .orElseThrow(() -> new IllegalArgumentException("Donate order not found"));
            if (!d.getUser().getUsername().equals(username))
                throw new IllegalStateException("Forbidden");

            DonateRank rank = d.getRank();
            if (!visibleToCaller(callerServer, rank.getServer())) {
                throw new IllegalStateException(
                        "Donate order belongs to a different Minecraft server");
            }

            if (d.isClaimed())
                return ResponseEntity.badRequest().body(Map.of("error", "Already claimed"));
            d.setClaimed(true);
            donateOrderRepository.save(d);
            command = rank.getCommand();
            name = rank.getName();
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
