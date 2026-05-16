package com.craftcms.service;

import com.craftcms.model.*;
import com.craftcms.repository.PaymentSettingsRepository;
import com.craftcms.repository.TopUpOrderRepository;
import com.craftcms.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    private final PaymentSettingsRepository settingsRepository;
    private final TopUpOrderRepository orderRepository;
    private final UserRepository userRepository;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    // ── Settings ─────────────────────────────────────────────────────────────

    public PaymentSettings getSettings() {
        return settingsRepository.findById(1L)
                .orElseGet(() -> settingsRepository.save(PaymentSettings.builder().build()));
    }

    @Transactional
    public PaymentSettings updateSettings(PaymentSettings incoming) {
        PaymentSettings s = getSettings();

        s.setFreekassaEnabled(incoming.isFreekassaEnabled());
        if (incoming.getFreekassaMerchantId() != null) s.setFreekassaMerchantId(incoming.getFreekassaMerchantId());
        if (incoming.getFreekassaSecretKey1() != null && !incoming.getFreekassaSecretKey1().isBlank())
            s.setFreekassaSecretKey1(incoming.getFreekassaSecretKey1());
        if (incoming.getFreekassaSecretKey2() != null && !incoming.getFreekassaSecretKey2().isBlank())
            s.setFreekassaSecretKey2(incoming.getFreekassaSecretKey2());

        s.setUnitpayEnabled(incoming.isUnitpayEnabled());
        if (incoming.getUnitpayPublicKey() != null) s.setUnitpayPublicKey(incoming.getUnitpayPublicKey());
        if (incoming.getUnitpaySecretKey() != null && !incoming.getUnitpaySecretKey().isBlank())
            s.setUnitpaySecretKey(incoming.getUnitpaySecretKey());

        s.setStripeEnabled(incoming.isStripeEnabled());
        if (incoming.getStripePublishableKey() != null) s.setStripePublishableKey(incoming.getStripePublishableKey());
        if (incoming.getStripeSecretKey() != null && !incoming.getStripeSecretKey().isBlank())
            s.setStripeSecretKey(incoming.getStripeSecretKey());
        if (incoming.getStripeWebhookSecret() != null && !incoming.getStripeWebhookSecret().isBlank())
            s.setStripeWebhookSecret(incoming.getStripeWebhookSecret());

        s.setYookassaEnabled(incoming.isYookassaEnabled());
        if (incoming.getYookassaShopId() != null) s.setYookassaShopId(incoming.getYookassaShopId());
        if (incoming.getYookassaSecretKey() != null && !incoming.getYookassaSecretKey().isBlank())
            s.setYookassaSecretKey(incoming.getYookassaSecretKey());

        s.setShowLogosInFooter(incoming.isShowLogosInFooter());
        if (incoming.getTopUpProvider() != null) s.setTopUpProvider(incoming.getTopUpProvider());
        return settingsRepository.save(s);
    }

    // ── Create top-up ────────────────────────────────────────────────────────

    @Transactional
    public String createTopUp(Long userId, BigDecimal amount, String siteUrl) {
        if (amount.compareTo(BigDecimal.ONE) < 0) throw new IllegalArgumentException("Минимальная сумма: 1 ₽");

        PaymentSettings settings = getSettings();
        if (settings.getTopUpProvider() == null || settings.getTopUpProvider().isBlank())
            throw new IllegalStateException("Платёжная система не настроена");

        PaymentProvider provider = PaymentProvider.valueOf(settings.getTopUpProvider());
        User user = userRepository.findById(userId).orElseThrow();

        String orderId = UUID.randomUUID().toString().replace("-", "");
        TopUpOrder order = TopUpOrder.builder()
                .id(orderId)
                .user(user)
                .amount(amount)
                .provider(provider)
                .build();
        orderRepository.save(order);

        return switch (provider) {
            case FREEKASSA -> buildFreekassaUrl(settings, orderId, amount, user.getUsername());
            case UNITPAY   -> buildUnitpayUrl(settings, orderId, amount);
            case STRIPE    -> createStripeSession(settings, orderId, amount, siteUrl);
            case YOOKASSA  -> createYookassaPayment(settings, orderId, amount, siteUrl);
        };
    }

    // ── FreeKassa ─────────────────────────────────────────────────────────────

    private String buildFreekassaUrl(PaymentSettings s, String orderId, BigDecimal amount, String username) {
        String amountStr = amount.toPlainString();
        String sign = md5(s.getFreekassaMerchantId() + ":" + amountStr + ":" + s.getFreekassaSecretKey1() + ":RUB:" + orderId);
        return "https://pay.freekassa.com/" +
               "?m=" + enc(s.getFreekassaMerchantId()) +
               "&oc=" + enc(orderId) +
               "&s=" + sign +
               "&us_login=" + enc(username) +
               "&sum=" + amountStr +
               "&currency=RUB" +
               "&lang=ru";
    }

    @Transactional
    public String handleFreekassaWebhook(String merchantId, String amount, String orderId,
                                          String sign, String currency) {
        PaymentSettings s = getSettings();
        String expected = md5(merchantId + ":" + amount + ":" + s.getFreekassaSecretKey2() + ":" + currency + ":" + orderId);
        if (!expected.equalsIgnoreCase(sign)) {
            log.warn("FreeKassa: invalid signature for order {}", orderId);
            return "NO";
        }
        completeOrder(orderId);
        return "YES";
    }

    // ── UnitPay ──────────────────────────────────────────────────────────────

    private String buildUnitpayUrl(PaymentSettings s, String orderId, BigDecimal amount) {
        String desc = "Пополнение баланса";
        String sign = buildUnitpaySignature(
                Map.of("account", orderId, "currency", "RUB", "desc", desc,
                        "projectId", s.getUnitpayPublicKey(), "sum", amount.toPlainString()),
                s.getUnitpaySecretKey());
        return "https://unitpay.money/pay/" + enc(s.getUnitpayPublicKey()) +
               "?account=" + enc(orderId) +
               "&sum=" + amount.toPlainString() +
               "&currency=RUB" +
               "&desc=" + enc(desc) +
               "&signature=" + sign;
    }

    private String buildUnitpaySignature(Map<String, String> params, String secretKey) {
        String data = params.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(Map.Entry::getValue)
                .collect(Collectors.joining("{up}"));
        return sha256Hex(data + "{up}" + secretKey);
    }

    @Transactional
    public Map<String, Object> handleUnitpayWebhook(String method, Map<String, String> params) {
        PaymentSettings s = getSettings();
        String orderId = params.get("account");
        String sum     = params.get("sum");
        String currency = params.getOrDefault("currency", "RUB");
        String unitpayId = params.getOrDefault("unitpayId", "");
        String recvSign = params.get("signature");

        String expectedSign = buildUnitpaySignature(
                Map.of("account", orderId, "currency", currency, "projectId",
                        s.getUnitpayPublicKey(), "sum", sum, "unitpayId", unitpayId),
                s.getUnitpaySecretKey());

        if (recvSign == null || !recvSign.equalsIgnoreCase(expectedSign)) {
            log.warn("UnitPay: invalid signature for order {}", orderId);
            return Map.of("error", Map.of("message", "Invalid signature"));
        }

        if ("pay".equals(method)) {
            completeOrder(orderId);
        }
        return Map.of("result", Map.of("message", "Успешно обработано"));
    }

    // ── Stripe ───────────────────────────────────────────────────────────────

    private String createStripeSession(PaymentSettings s, String orderId, BigDecimal amount, String siteUrl) {
        long amountCents = amount.multiply(BigDecimal.valueOf(100)).longValue();
        String body = "mode=payment" +
                      "&currency=rub" +
                      "&line_items[0][quantity]=1" +
                      "&line_items[0][price_data][currency]=rub" +
                      "&line_items[0][price_data][unit_amount]=" + amountCents +
                      "&line_items[0][price_data][product_data][name]=Пополнение+баланса" +
                      "&success_url=" + enc(siteUrl + "/payment/success?orderId=" + orderId) +
                      "&cancel_url=" + enc(siteUrl + "/payment/cancel") +
                      "&metadata[orderId]=" + orderId;
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.stripe.com/v1/checkout/sessions"))
                    .header("Authorization", "Bearer " + s.getStripeSecretKey())
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            String responseBody = resp.body();
            // Parse the url field from JSON response
            String url = extractJson(responseBody, "url");
            if (url == null) throw new RuntimeException("Stripe error: " + responseBody);
            return url;
        } catch (Exception e) {
            throw new RuntimeException("Ошибка создания Stripe сессии: " + e.getMessage(), e);
        }
    }

    @Transactional
    public void handleStripeWebhook(String payload, String sigHeader) {
        PaymentSettings s = getSettings();
        if (!verifyStripeSignature(payload, sigHeader, s.getStripeWebhookSecret())) {
            log.warn("Stripe: invalid webhook signature");
            throw new SecurityException("Invalid Stripe signature");
        }
        String eventType = extractJson(payload, "type");
        if ("checkout.session.completed".equals(eventType)) {
            String metadataBlock = extractJsonBlock(payload, "metadata");
            if (metadataBlock != null) {
                String orderId = extractJson(metadataBlock, "orderId");
                if (orderId != null) completeOrder(orderId);
            }
        }
    }

    private boolean verifyStripeSignature(String payload, String sigHeader, String webhookSecret) {
        try {
            Map<String, String> parts = Arrays.stream(sigHeader.split(","))
                    .map(p -> p.split("=", 2))
                    .filter(a -> a.length == 2)
                    .collect(Collectors.toMap(a -> a[0], a -> a[1], (a, b) -> a));
            String timestamp = parts.get("t");
            String v1 = parts.get("v1");
            if (timestamp == null || v1 == null) return false;
            String signed = timestamp + "." + payload;
            String expected = hmacSha256Hex(webhookSecret, signed);
            return expected.equalsIgnoreCase(v1);
        } catch (Exception e) {
            return false;
        }
    }

    // ── YooKassa ─────────────────────────────────────────────────────────────

    private String createYookassaPayment(PaymentSettings s, String orderId, BigDecimal amount, String siteUrl) {
        String credentials = Base64.getEncoder().encodeToString(
                (s.getYookassaShopId() + ":" + s.getYookassaSecretKey()).getBytes(StandardCharsets.UTF_8));
        String body = "{" +
                "\"amount\":{\"value\":\"" + String.format("%.2f", amount) + "\",\"currency\":\"RUB\"}," +
                "\"confirmation\":{\"type\":\"redirect\",\"return_url\":\"" +
                siteUrl + "/payment/success?orderId=" + orderId + "\"}," +
                "\"description\":\"Пополнение баланса\"," +
                "\"metadata\":{\"orderId\":\"" + orderId + "\"}," +
                "\"capture\":true" +
                "}";
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.yookassa.ru/v3/payments"))
                    .header("Authorization", "Basic " + credentials)
                    .header("Content-Type", "application/json")
                    .header("Idempotence-Key", orderId)
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            String responseBody = resp.body();
            String confirmUrl = extractNestedJson(responseBody, "confirmation", "confirmation_url");
            if (confirmUrl == null) throw new RuntimeException("YooKassa error: " + responseBody);
            return confirmUrl;
        } catch (Exception e) {
            throw new RuntimeException("Ошибка создания YooKassa платежа: " + e.getMessage(), e);
        }
    }

    @Transactional
    public void handleYookassaWebhook(String payload) {
        String eventType = extractJson(payload, "type");
        if ("payment.succeeded".equals(eventType)) {
            String metadataBlock = extractJsonBlock(payload, "metadata");
            if (metadataBlock != null) {
                String orderId = extractJson(metadataBlock, "orderId");
                if (orderId != null) completeOrder(orderId);
            }
        }
    }

    // ── Complete order ────────────────────────────────────────────────────────

    @Transactional
    public synchronized void completeOrder(String orderId) {
        TopUpOrder order = orderRepository.findById(orderId).orElse(null);
        if (order == null || order.getStatus() != TopUpStatus.PENDING) return;

        order.setStatus(TopUpStatus.COMPLETED);
        order.setCompletedAt(LocalDateTime.now());
        orderRepository.save(order);

        User user = order.getUser();
        user.setBalance(user.getBalance().add(order.getAmount()));
        userRepository.save(user);

        log.info("TopUp completed: {} +{} via {}", user.getUsername(), order.getAmount(), order.getProvider());
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    public Page<TopUpOrder> getAllOrders(Pageable pageable) {
        return orderRepository.findAllByOrderByCreatedAtDesc(pageable);
    }

    public List<TopUpOrder> getUserOrders(Long userId) {
        return orderRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    // ── Crypto utils ──────────────────────────────────────────────────────────

    private String md5(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private String hmacSha256Hex(String key, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    // Minimal JSON field extractor (avoids extra dependencies)
    private String extractJson(String json, String key) {
        String pattern = "\"" + key + "\"";
        int idx = json.indexOf(pattern);
        if (idx < 0) return null;
        int colon = json.indexOf(':', idx + pattern.length());
        if (colon < 0) return null;
        int start = colon + 1;
        while (start < json.length() && Character.isWhitespace(json.charAt(start))) start++;
        if (start >= json.length()) return null;
        char first = json.charAt(start);
        if (first == '"') {
            int end = start + 1;
            while (end < json.length() && json.charAt(end) != '"') {
                if (json.charAt(end) == '\\') end++;
                end++;
            }
            return json.substring(start + 1, Math.min(end, json.length()));
        }
        int end = start;
        while (end < json.length() && ",}]\n\r".indexOf(json.charAt(end)) < 0) end++;
        return json.substring(start, end).trim();
    }

    private String extractJsonBlock(String json, String key) {
        String pattern = "\"" + key + "\"";
        int idx = json.indexOf(pattern);
        if (idx < 0) return null;
        int brace = json.indexOf('{', idx + pattern.length());
        if (brace < 0) return null;
        int depth = 0, end = brace;
        while (end < json.length()) {
            char c = json.charAt(end);
            if (c == '{') depth++;
            else if (c == '}') { depth--; if (depth == 0) { end++; break; } }
            end++;
        }
        return json.substring(brace, end);
    }

    private String extractNestedJson(String json, String outerKey, String innerKey) {
        String block = extractJsonBlock(json, outerKey);
        if (block == null) return null;
        return extractJson(block, innerKey);
    }
}
