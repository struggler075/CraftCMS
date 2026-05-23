package com.craftcms.service;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class WsTokenService {

    private static final Duration TTL = Duration.ofSeconds(60);

    private final ConcurrentHashMap<String, Entry> tokens = new ConcurrentHashMap<>();

    /** Issue a single-use token that carries the github token inside it. */
    public String create(String githubToken) {
        String token = UUID.randomUUID().toString();
        tokens.put(token, new Entry(githubToken, Instant.now().plus(TTL)));
        // Opportunistically purge expired entries to keep the map small.
        tokens.entrySet().removeIf(e -> !e.getValue().isValid());
        return token;
    }

    /**
     * Consume the token (removes it so it can't be reused).
     * Returns the embedded github token if the ws-token is valid and unexpired.
     */
    public Optional<String> consume(String token) {
        Entry entry = tokens.remove(token);
        if (entry != null && entry.isValid()) {
            return Optional.of(entry.githubToken());
        }
        return Optional.empty();
    }

    private record Entry(String githubToken, Instant expiry) {
        boolean isValid() {
            return Instant.now().isBefore(expiry);
        }
    }
}
