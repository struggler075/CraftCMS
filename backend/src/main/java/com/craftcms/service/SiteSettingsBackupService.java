package com.craftcms.service;

import com.craftcms.model.SiteSettings;
import com.craftcms.repository.SiteSettingsRepository;
import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.PropertyAccessor;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.FileTime;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

/**
 * Persists JSON snapshots of {@link SiteSettings} to disk so the row can
 * always be restored from a recent file, even if pg_dump was missed.
 *
 * <p>Two write paths:
 * <ul>
 *     <li><b>Pre-write</b>: {@code SiteSettingsService.update()} calls
 *         {@link #snapshot(SiteSettings, String)} before mutating the row,
 *         so we always have the "last good" state on disk.</li>
 *     <li><b>Hourly</b>: an @Scheduled task captures a periodic baseline
 *         even when no admin edit happens.</li>
 * </ul>
 *
 * <p>Older snapshots are auto-pruned (keep last 168 ≈ a week of hourly +
 * however many manual updates fit in 30 days, whichever is more permissive).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SiteSettingsBackupService {

    private static final int  KEEP_COUNT      = 168;          // ~1 week if hourly
    private static final Duration KEEP_WINDOW = Duration.ofDays(30);
    private static final DateTimeFormatter FILE_TS =
            DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").withZone(ZoneId.systemDefault());

    @Value("${craftcms.backup.dir:/opt/craftcms/backups/site-settings}")
    private String backupDir;

    private final SiteSettingsRepository repository;

    private final ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .enable(SerializationFeature.INDENT_OUTPUT)
            // Bypass @JsonIgnore — for the snapshot file we WANT id/version/updatedAt.
            .setVisibility(PropertyAccessor.FIELD, JsonAutoDetect.Visibility.ANY)
            .setVisibility(PropertyAccessor.GETTER, JsonAutoDetect.Visibility.NONE)
            .setVisibility(PropertyAccessor.IS_GETTER, JsonAutoDetect.Visibility.NONE);

    @PostConstruct
    void ensureDir() {
        try {
            Files.createDirectories(Paths.get(backupDir));
        } catch (IOException e) {
            // Don't fail boot — log loudly. Snapshots will retry on every write.
            log.warn("SiteSettings backup dir is not writable at {}: {}. " +
                     "Snapshots will be skipped until this is fixed.", backupDir, e.getMessage());
        }
    }

    /** Synchronously write a snapshot. Never throws — backup failure must not break the caller. */
    public void snapshot(SiteSettings settings, String reason) {
        try {
            Path dir = Paths.get(backupDir);
            Files.createDirectories(dir);
            String fname = "site-settings-" + FILE_TS.format(Instant.now()) +
                    "-" + sanitize(reason) + ".json";
            Path file = dir.resolve(fname);
            // Write atomically: tmp then move, so a half-written file never lingers.
            Path tmp = dir.resolve(fname + ".tmp");
            mapper.writeValue(tmp.toFile(), settings);
            Files.move(tmp, file, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            log.debug("SiteSettings snapshot written: {}", file.getFileName());
            prune(dir);
        } catch (Exception e) {
            log.error("Failed to write SiteSettings snapshot ({}): {}", reason, e.getMessage());
        }
    }

    /** Periodic baseline. Fixed-delay so a slow disk can't pile up overlapping runs. */
    @Scheduled(fixedDelay = 60 * 60 * 1000L, initialDelay = 5 * 60 * 1000L)
    void hourlySnapshot() {
        repository.findById(1L).ifPresentOrElse(
                s -> snapshot(s, "hourly"),
                () -> log.error("Hourly SiteSettings snapshot skipped — singleton row id=1 is MISSING. " +
                                "This is the alarm bell: the row should always exist.")
        );
    }

    /** Most recent snapshot file, if any — used by admin "восстановить" button. */
    public List<Path> listSnapshots() {
        try (Stream<Path> files = Files.list(Paths.get(backupDir))) {
            return files
                    .filter(p -> p.getFileName().toString().endsWith(".json"))
                    .sorted(Comparator.comparing(SiteSettingsBackupService::lastModified).reversed())
                    .toList();
        } catch (IOException e) {
            return List.of();
        }
    }

    public SiteSettings load(Path snapshotPath) throws IOException {
        return mapper.readValue(snapshotPath.toFile(), SiteSettings.class);
    }

    // ── retention ────────────────────────────────────────────────────────────

    private void prune(Path dir) {
        try (Stream<Path> files = Files.list(dir)) {
            List<Path> all = files
                    .filter(p -> p.getFileName().toString().endsWith(".json"))
                    .sorted(Comparator.comparing(SiteSettingsBackupService::lastModified).reversed())
                    .toList();

            Instant cutoff = Instant.now().minus(KEEP_WINDOW);
            for (int i = 0; i < all.size(); i++) {
                Path p = all.get(i);
                boolean tooOld   = lastModified(p).isBefore(cutoff);
                boolean tooMany  = i >= KEEP_COUNT;
                if (tooOld && tooMany) {
                    try { Files.deleteIfExists(p); } catch (IOException ignored) {}
                }
            }
        } catch (IOException ignored) {}
    }

    private static Instant lastModified(Path p) {
        try { return Files.getLastModifiedTime(p).toInstant(); }
        catch (IOException e) { return Instant.EPOCH; }
    }

    private static String sanitize(String reason) {
        if (reason == null) return "auto";
        return reason.replaceAll("[^a-zA-Z0-9_-]", "_");
    }
}
