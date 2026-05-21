package com.craftcms.service;

import com.craftcms.model.MinecraftServer;
import com.craftcms.model.PlayerRankCache;
import com.craftcms.repository.PlayerRankCacheRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * Talks to a Minecraft server's BridgePlugin over HTTP to fetch the player's
 * current LuckPerms groups. The plugin is expected to expose:
 *
 *   GET <pluginUrl>/luckperms/{username}
 *   X-Bridge-Key: <server.bridgeApiKey>
 *
 *   200 OK  {
 *     "groups": [
 *       { "name": "vip", "displayName": "VIP", "color": "#22c55e", "expiresAt": "2026-09-01T12:00:00" },
 *       ...
 *     ]
 *   }
 *
 * The fetcher is best-effort: any server that times out / errors out is logged
 * and skipped — its previous cache row stays valid until the next successful sync.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PluginRankFetcher {

    private final PlayerRankCacheRepository cacheRepo;
    private final ObjectMapper objectMapper;

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(5);

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    /** Fetches the player's groups from a single server and refreshes its cache rows. */
    @Transactional
    public void refresh(MinecraftServer server, String username) {
        if (server.getPluginUrl() == null || server.getPluginUrl().isBlank()) {
            log.debug("Server '{}' has no pluginUrl — skipping", server.getName());
            return;
        }
        if (server.getBridgeApiKey() == null || server.getBridgeApiKey().isBlank()) {
            log.debug("Server '{}' has no bridgeApiKey — skipping", server.getName());
            return;
        }

        String base = server.getPluginUrl().replaceAll("/+$", "");
        URI uri = URI.create(base + "/luckperms/" + username);

        HttpRequest req = HttpRequest.newBuilder()
                .uri(uri)
                .timeout(REQUEST_TIMEOUT)
                .header("X-Bridge-Key", server.getBridgeApiKey())
                .header("Accept", "application/json")
                .GET()
                .build();

        try {
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() == 404) {
                // Player has no LP record on this server — clear any stale cache.
                cacheRepo.deleteByUsernameAndServerId(username, server.getId());
                return;
            }
            if (res.statusCode() != 200) {
                log.warn("Plugin {} returned {} for {}", server.getName(), res.statusCode(), username);
                return;
            }
            applySnapshot(server, username, res.body());
        } catch (Exception e) {
            log.warn("Failed to fetch ranks from {} for {}: {}", server.getName(), username, e.getMessage());
        }
    }

    /** Replaces every cache row for (username, server) with the freshly-fetched set. */
    private void applySnapshot(MinecraftServer server, String username, String json) {
        List<PlayerRankCache> fresh = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode groups = root.path("groups");
            if (!groups.isArray()) return;

            LocalDateTime now = LocalDateTime.now();
            for (JsonNode g : groups) {
                String name = g.path("name").asText("").trim();
                if (name.isEmpty()) continue;
                LocalDateTime expiresAt = parseDate(g.path("expiresAt").asText(null));
                fresh.add(PlayerRankCache.builder()
                        .username(username)
                        .server(server)
                        .groupName(name)
                        .displayName(nullIfBlank(g.path("displayName").asText("")))
                        .color(nullIfBlank(g.path("color").asText("")))
                        .expiresAt(expiresAt)
                        .syncedAt(now)
                        .build());
            }
        } catch (Exception e) {
            log.warn("Bad LP snapshot JSON from {}: {}", server.getName(), e.getMessage());
            return;
        }

        // Atomic replace — wipe previous rows for this (user, server) then re-insert.
        cacheRepo.deleteByUsernameAndServerId(username, server.getId());
        if (!fresh.isEmpty()) cacheRepo.saveAll(fresh);
    }

    private static LocalDateTime parseDate(String s) {
        if (s == null || s.isBlank() || "null".equalsIgnoreCase(s)) return null;
        try {
            return LocalDateTime.parse(s, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (Exception e) {
            return null;
        }
    }

    private static String nullIfBlank(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
