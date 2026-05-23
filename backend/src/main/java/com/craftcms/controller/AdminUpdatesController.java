package com.craftcms.controller;

import com.craftcms.dto.CommitDto;
import com.craftcms.dto.UpdatesStatusDto;
import com.craftcms.model.SiteSettings;
import com.craftcms.service.SiteSettingsService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/admin/updates")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class AdminUpdatesController {

    private final SiteSettingsService siteSettingsService;
    private final RestTemplate restTemplate;

    @Value("${app.github.repo:struggler075/CraftCMS}")
    private String githubRepo;

    private static final Duration CACHE_TTL = Duration.ofMinutes(5);
    private static final Pattern COMMIT_TYPE_PATTERN = Pattern.compile(
            "^(feat|fix|hotfix|chore|refactor|docs|test|style|perf|ci|build|revert)(\\(.+\\))?(!)?:"
    );

    private volatile CacheEntry cache;

    @GetMapping
    public ResponseEntity<UpdatesStatusDto> getStatus() {
        SiteSettings settings = siteSettingsService.get();
        String token = settings.getGithubToken();
        boolean tokenSet = token != null && !token.isBlank();

        if (!tokenSet) {
            return ResponseEntity.ok(new UpdatesStatusDto(
                    "unconfigured", "Токен не настроен", false, githubRepo, List.of()
            ));
        }

        // Serve from cache if still fresh
        CacheEntry current = cache;
        if (current != null && current.isValid()) {
            return ResponseEntity.ok(new UpdatesStatusDto(
                    current.status, label(current.status), true, githubRepo, current.commits
            ));
        }

        // Re-validate against GitHub
        try {
            HttpHeaders headers = githubHeaders(token);
            HttpEntity<Void> req = new HttpEntity<>(headers);

            // Verify the token is alive
            restTemplate.exchange("https://api.github.com/user", HttpMethod.GET, req, JsonNode.class);

            // Fetch commits
            List<CommitDto> commits = List.of();
            try {
                ResponseEntity<JsonNode> resp = restTemplate.exchange(
                        "https://api.github.com/repos/" + githubRepo + "/commits?per_page=30",
                        HttpMethod.GET, req, JsonNode.class
                );
                if (resp.getBody() != null && resp.getBody().isArray()) {
                    commits = parseCommits(resp.getBody());
                }
            } catch (Exception e) {
                log.warn("Could not fetch commits for {}: {}", githubRepo, e.getMessage());
            }

            cache = new CacheEntry("active", commits);
            return ResponseEntity.ok(new UpdatesStatusDto("active", "Лицензия активна", true, githubRepo, commits));

        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.UNAUTHORIZED || e.getStatusCode() == HttpStatus.FORBIDDEN) {
                cache = new CacheEntry("inactive", List.of());
                return ResponseEntity.ok(new UpdatesStatusDto("inactive", "Лицензия не активна", true, githubRepo, List.of()));
            }
            log.warn("GitHub API error {}: {}", e.getStatusCode(), e.getMessage());
            if (current != null) {
                return ResponseEntity.ok(new UpdatesStatusDto(current.status, label(current.status), true, githubRepo, current.commits));
            }
            return ResponseEntity.ok(new UpdatesStatusDto("inactive", "Ошибка подключения к GitHub", true, githubRepo, List.of()));
        } catch (Exception e) {
            log.warn("GitHub API unreachable: {}", e.getMessage());
            if (current != null) {
                return ResponseEntity.ok(new UpdatesStatusDto(current.status, label(current.status), true, githubRepo, current.commits));
            }
            return ResponseEntity.ok(new UpdatesStatusDto("inactive", "Ошибка подключения", true, githubRepo, List.of()));
        }
    }

    @PutMapping("/token")
    public ResponseEntity<Map<String, String>> updateToken(@RequestBody Map<String, String> body) {
        siteSettingsService.updateGithubToken(body.get("token"));
        cache = null; // invalidate so next GET re-validates immediately
        return ResponseEntity.ok(Map.of("message", "Лицензионный токен обновлён"));
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private HttpHeaders githubHeaders(String token) {
        HttpHeaders h = new HttpHeaders();
        h.set("Authorization", "Bearer " + token);
        h.set("Accept", "application/vnd.github.v3+json");
        h.set("X-GitHub-Api-Version", "2022-11-28");
        return h;
    }

    private List<CommitDto> parseCommits(JsonNode arr) {
        List<CommitDto> list = new ArrayList<>();
        for (JsonNode node : arr) {
            try {
                String sha = node.path("sha").asText();
                String shortSha = sha.length() >= 7 ? sha.substring(0, 7) : sha;
                String htmlUrl = node.path("html_url").asText();

                JsonNode commitNode = node.path("commit");
                String fullMsg = commitNode.path("message").asText();
                String firstLine = fullMsg.split("\n")[0].trim();
                String date = commitNode.path("author").path("date").asText();
                String authorName = commitNode.path("author").path("name").asText();

                String avatarUrl = "";
                JsonNode authorNode = node.path("author");
                if (!authorNode.isMissingNode() && !authorNode.isNull()) {
                    avatarUrl = authorNode.path("avatar_url").asText("");
                }

                list.add(new CommitDto(sha, shortSha, firstLine, authorName, avatarUrl, date, htmlUrl, extractType(firstLine)));
            } catch (Exception e) {
                log.debug("Skipping malformed commit node: {}", e.getMessage());
            }
        }
        return list;
    }

    private String extractType(String message) {
        Matcher m = COMMIT_TYPE_PATTERN.matcher(message);
        return m.find() ? m.group(1) : "commit";
    }

    private String label(String status) {
        return switch (status) {
            case "active"   -> "Лицензия активна";
            case "inactive" -> "Лицензия не активна";
            default         -> "Не настроено";
        };
    }

    // Simple volatile-reference cache — thread-safe for reads; at worst two
    // concurrent cache misses both refresh simultaneously, which is harmless.
    private static class CacheEntry {
        final String status;
        final List<CommitDto> commits;
        final Instant expiry;

        CacheEntry(String status, List<CommitDto> commits) {
            this.status  = status;
            this.commits = commits;
            this.expiry  = Instant.now().plus(CACHE_TTL);
        }

        boolean isValid() { return Instant.now().isBefore(expiry); }
    }
}
