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
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
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

    @Value("${app.install-dir:/opt/craftcms}")
    private String installDir;

    private static final Duration CACHE_TTL = Duration.ofMinutes(5);
    private static final Pattern COMMIT_TYPE_PATTERN = Pattern.compile(
            "^(feat|fix|hotfix|chore|refactor|docs|test|style|perf|ci|build|revert)(\\(.+\\))?(!)?:"
    );

    private volatile CacheEntry cache;

    // ── GET /api/admin/updates ────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<UpdatesStatusDto> getStatus(
            @RequestParam(defaultValue = "false") boolean refresh) {
        SiteSettings settings = siteSettingsService.get();
        String token = settings.getGithubToken();
        boolean tokenSet = token != null && !token.isBlank();

        if (!tokenSet) {
            return ResponseEntity.ok(new UpdatesStatusDto(
                    "unconfigured", "Токен не настроен", false, githubRepo,
                    null, false, List.of(), List.of()
            ));
        }

        // Serve from cache if still fresh (skip when manual refresh requested)
        if (refresh) cache = null;
        CacheEntry current = cache;
        if (current != null && current.isValid()) {
            return ResponseEntity.ok(buildDto("active", true, current.pending, current.installed));
        }

        try {
            HttpHeaders headers = githubHeaders(token);
            HttpEntity<Void> req = new HttpEntity<>(headers);

            // 1. Verify the token is alive
            restTemplate.exchange("https://api.github.com/user", HttpMethod.GET, req, JsonNode.class);

            // 2. Fetch last 100 commits
            List<CommitDto> allCommits = fetchCommits(req);

            // 3. Split into pending / installed based on version.txt
            String currentSha = readCurrentVersion();
            SplitResult split = splitCommits(allCommits, currentSha);

            cache = new CacheEntry(split.pending, split.installed);
            return ResponseEntity.ok(buildDto("active", true, split.pending, split.installed));

        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.UNAUTHORIZED || e.getStatusCode() == HttpStatus.FORBIDDEN) {
                cache = new CacheEntry(List.of(), List.of());
                return ResponseEntity.ok(new UpdatesStatusDto(
                        "inactive", "Лицензия не активна", true, githubRepo,
                        null, false, List.of(), List.of()
                ));
            }
            log.warn("GitHub API error {}: {}", e.getStatusCode(), e.getMessage());
            if (current != null) return ResponseEntity.ok(buildDto("active", true, current.pending, current.installed));
            return ResponseEntity.ok(new UpdatesStatusDto(
                    "inactive", "Ошибка подключения к GitHub", true, githubRepo,
                    null, false, List.of(), List.of()
            ));
        } catch (Exception e) {
            log.warn("GitHub API unreachable: {}", e.getMessage());
            if (current != null) return ResponseEntity.ok(buildDto("active", true, current.pending, current.installed));
            return ResponseEntity.ok(new UpdatesStatusDto(
                    "inactive", "Ошибка подключения", true, githubRepo,
                    null, false, List.of(), List.of()
            ));
        }
    }

    // ── PUT /api/admin/updates/token ──────────────────────────────────────────

    @PutMapping("/token")
    public ResponseEntity<Map<String, String>> updateToken(@RequestBody Map<String, String> body) {
        siteSettingsService.updateGithubToken(body.get("token"));
        cache = null;
        return ResponseEntity.ok(Map.of("message", "Лицензионный токен обновлён"));
    }

    // ── POST /api/admin/updates/apply ─────────────────────────────────────────

    @PostMapping("/apply")
    public ResponseEntity<Map<String, String>> applyUpdate() {
        String script = installDir + "/update.sh";
        log.info("Update triggered by {}", actorName());
        try {
            // setsid creates a new session so the child outlives the parent JVM
            // when systemctl stop craftcms kills this process.
            new ProcessBuilder("bash", "-c",
                    "nohup setsid bash " + script + " > /var/log/craftcms-update.log 2>&1 < /dev/null &")
                    .start();
            cache = null;
            return ResponseEntity.accepted().body(Map.of("message", "Обновление запущено"));
        } catch (IOException e) {
            log.error("Failed to start update script: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("message", "Не удалось запустить: " + e.getMessage()));
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private UpdatesStatusDto buildDto(String status, boolean tokenSet,
                                      List<CommitDto> pending, List<CommitDto> installed) {
        String currentVersion = installed.isEmpty() ? null : installed.get(0).shortSha();
        return new UpdatesStatusDto(
                status, "Лицензия активна", tokenSet, githubRepo,
                currentVersion, !pending.isEmpty(), pending, installed
        );
    }

    private List<CommitDto> fetchCommits(HttpEntity<Void> req) {
        try {
            ResponseEntity<JsonNode> resp = restTemplate.exchange(
                    "https://api.github.com/repos/" + githubRepo + "/commits?per_page=100",
                    HttpMethod.GET, req, JsonNode.class
            );
            if (resp.getBody() != null && resp.getBody().isArray()) {
                return parseCommits(resp.getBody());
            }
        } catch (Exception e) {
            log.warn("Could not fetch commits for {}: {}", githubRepo, e.getMessage());
        }
        return List.of();
    }

    private String readCurrentVersion() {
        try {
            Path p = Paths.get(installDir, "version.txt");
            if (Files.exists(p)) return Files.readString(p).trim();
        } catch (Exception ignored) {}
        return null;
    }

    private SplitResult splitCommits(List<CommitDto> all, String currentSha) {
        if (currentSha == null || currentSha.isBlank()) {
            // No version.txt → installed version unknown, treat all commits as pending
            // so the user can apply to write version.txt and establish a baseline.
            return new SplitResult(all, List.of());
        }

        List<CommitDto> pending = new ArrayList<>();
        List<CommitDto> installed = new ArrayList<>();
        boolean found = false;

        for (CommitDto c : all) {
            if (!found && (c.sha().equals(currentSha) || c.sha().startsWith(currentSha)
                    || currentSha.startsWith(c.shortSha()))) {
                found = true;
            }
            if (found) installed.add(c);
            else pending.add(c);
        }

        if (!found) {
            // Current version is older than 100 commits — everything is history
            return new SplitResult(List.of(), all);
        }
        return new SplitResult(pending, installed);
    }

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
                String firstLine = commitNode.path("message").asText().split("\n")[0].trim();
                String date = commitNode.path("author").path("date").asText();
                String authorName = commitNode.path("author").path("name").asText();
                String avatarUrl = "";
                JsonNode authorNode = node.path("author");
                if (!authorNode.isMissingNode() && !authorNode.isNull()) {
                    avatarUrl = authorNode.path("avatar_url").asText("");
                }
                list.add(new CommitDto(sha, shortSha, firstLine, authorName, avatarUrl, date, htmlUrl, extractType(firstLine)));
            } catch (Exception e) {
                log.debug("Skipping malformed commit: {}", e.getMessage());
            }
        }
        return list;
    }

    private String extractType(String message) {
        Matcher m = COMMIT_TYPE_PATTERN.matcher(message);
        return m.find() ? m.group(1) : "commit";
    }

    private String actorName() {
        try {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            return auth != null ? auth.getName() : "unknown";
        } catch (Exception e) { return "unknown"; }
    }

    private static class CacheEntry {
        final List<CommitDto> pending;
        final List<CommitDto> installed;
        final Instant expiry;

        CacheEntry(List<CommitDto> pending, List<CommitDto> installed) {
            this.pending   = pending;
            this.installed = installed;
            this.expiry    = Instant.now().plus(CACHE_TTL);
        }

        boolean isValid() { return Instant.now().isBefore(expiry); }
    }

    private record SplitResult(List<CommitDto> pending, List<CommitDto> installed) {}
}
