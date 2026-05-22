package com.craftcms.service;

import com.craftcms.model.AuditAction;
import com.craftcms.model.SiteSettings;
import com.craftcms.repository.SiteSettingsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;

/**
 * Singleton settings — exactly one row with id=1 exists in the database.
 * Seeded once by {@link com.craftcms.config.DataInitializer} on first boot.
 *
 * <p>{@link #get()} intentionally does NOT create a row on miss. A missing
 * row means something went catastrophically wrong (manual delete, restored
 * partial backup, migration bug) and we want a loud 500, not a silent reset
 * of the admin's customisations to defaults.
 *
 * <p>Every successful update is captured in the audit log with a field-level
 * diff so an operator can always answer "who reset what, and when". The
 * {@link SiteSettingsBackupService} writes a JSON snapshot to disk both
 * hourly and immediately before each update, so restore is a one-liner.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SiteSettingsService {

    static final long SINGLETON_ID = 1L;

    private final SiteSettingsRepository repository;
    private final AuditLogService auditLogService;
    private final SiteSettingsBackupService backupService;

    @Transactional(readOnly = true)
    public SiteSettings get() {
        return repository.findById(SINGLETON_ID).orElseThrow(() ->
                new IllegalStateException(
                        "SiteSettings row id=1 is missing. It is seeded once at boot; " +
                        "if it disappeared, restore from /opt/craftcms/backups/ or " +
                        "restart the service to let DataInitializer re-create it."));
    }

    @Transactional
    public SiteSettings update(SiteSettings incoming) {
        SiteSettings before = get();

        // Snapshot to disk BEFORE touching the row — gives us a rollback point
        // even if the new transaction succeeds with a value the admin regrets.
        backupService.snapshot(before, "pre-update");

        // Capture a copy of pre-state for the audit diff. Hibernate would
        // otherwise mutate `before` in-place and the diff would be empty.
        SiteSettings snapshot = copyForDiff(before);

        // null  → "do not touch this field"  (partial PUT)
        // ""    → "clear this nullable field" (only for fields documented as such — logo, donate header)
        // value → "set to value"
        if (incoming.getSiteName() != null)              before.setSiteName(incoming.getSiteName());
        if (incoming.getSiteDescription() != null)       before.setSiteDescription(incoming.getSiteDescription());
        if (incoming.getLogoUrl() != null)               before.setLogoUrl(incoming.getLogoUrl().isBlank() ? null : incoming.getLogoUrl());
        if (incoming.getCopyrightText() != null)         before.setCopyrightText(incoming.getCopyrightText());
        if (incoming.getDisclaimerText() != null)        before.setDisclaimerText(incoming.getDisclaimerText());
        if (incoming.getFooterColumnsJson() != null)     before.setFooterColumnsJson(incoming.getFooterColumnsJson());
        if (incoming.getHeroTitle() != null)             before.setHeroTitle(incoming.getHeroTitle());
        if (incoming.getHeroSubtitle() != null)          before.setHeroSubtitle(incoming.getHeroSubtitle());
        if (incoming.getDonateHeaderImageUrl() != null)  before.setDonateHeaderImageUrl(incoming.getDonateHeaderImageUrl().isBlank() ? null : incoming.getDonateHeaderImageUrl());
        if (incoming.getSiteUrl() != null)               before.setSiteUrl(incoming.getSiteUrl());
        if (incoming.getBanKickMessage() != null)        before.setBanKickMessage(incoming.getBanKickMessage());
        // bridgeApiKey is rotation-sensitive — empty string is "don't change", real value is "rotate to this".
        if (incoming.getBridgeApiKey() != null && !incoming.getBridgeApiKey().isBlank())
            before.setBridgeApiKey(incoming.getBridgeApiKey());
        if (incoming.getBridgeAllowedIp() != null)       before.setBridgeAllowedIp(incoming.getBridgeAllowedIp());
        if (incoming.getBridgeBackendUrl() != null)      before.setBridgeBackendUrl(incoming.getBridgeBackendUrl());
        if (incoming.getPrimaryColor() != null)          before.setPrimaryColor(incoming.getPrimaryColor());
        if (incoming.getBgColor() != null)               before.setBgColor(incoming.getBgColor());
        // Note: emailVerificationRequired (primitive boolean) is intentionally NOT
        // patched here — Jackson defaults a missing field to false on the entity
        // and we don't want a partial PUT to silently disable the flag.

        before.setUpdatedAt(Instant.now());
        SiteSettings saved = repository.save(before);

        String diff = describeChanges(snapshot, saved);
        if (!diff.isEmpty()) {
            auditLogService.log(AuditAction.SETTINGS_UPDATE, null, diff);
            log.info("SiteSettings updated by {}: {}", currentActorName(), diff);
        }
        return saved;
    }

    /** Replace the singleton row with a previously saved snapshot — used by manual restore. */
    @Transactional
    public SiteSettings restoreFrom(SiteSettings snapshot) {
        SiteSettings live = get();
        backupService.snapshot(live, "pre-restore");

        live.setSiteName(snapshot.getSiteName());
        live.setSiteDescription(snapshot.getSiteDescription());
        live.setLogoUrl(snapshot.getLogoUrl());
        live.setCopyrightText(snapshot.getCopyrightText());
        live.setDisclaimerText(snapshot.getDisclaimerText());
        live.setFooterColumnsJson(snapshot.getFooterColumnsJson());
        live.setHeroTitle(snapshot.getHeroTitle());
        live.setHeroSubtitle(snapshot.getHeroSubtitle());
        live.setDonateHeaderImageUrl(snapshot.getDonateHeaderImageUrl());
        live.setSiteUrl(snapshot.getSiteUrl());
        live.setBanKickMessage(snapshot.getBanKickMessage());
        live.setBridgeApiKey(snapshot.getBridgeApiKey());
        live.setBridgeAllowedIp(snapshot.getBridgeAllowedIp());
        live.setBridgeBackendUrl(snapshot.getBridgeBackendUrl());
        live.setPrimaryColor(snapshot.getPrimaryColor());
        live.setBgColor(snapshot.getBgColor());
        live.setUpdatedAt(Instant.now());

        SiteSettings saved = repository.save(live);
        auditLogService.log(AuditAction.SETTINGS_RESTORE, null, "восстановление из снапшота");
        log.warn("SiteSettings restored from snapshot by {}", currentActorName());
        return saved;
    }

    // ── diff helpers ─────────────────────────────────────────────────────────

    private SiteSettings copyForDiff(SiteSettings s) {
        return SiteSettings.builder()
                .siteName(s.getSiteName()).siteDescription(s.getSiteDescription())
                .logoUrl(s.getLogoUrl()).copyrightText(s.getCopyrightText())
                .disclaimerText(s.getDisclaimerText()).footerColumnsJson(s.getFooterColumnsJson())
                .heroTitle(s.getHeroTitle()).heroSubtitle(s.getHeroSubtitle())
                .donateHeaderImageUrl(s.getDonateHeaderImageUrl()).siteUrl(s.getSiteUrl())
                .banKickMessage(s.getBanKickMessage()).bridgeApiKey(s.getBridgeApiKey())
                .bridgeAllowedIp(s.getBridgeAllowedIp()).bridgeBackendUrl(s.getBridgeBackendUrl())
                .primaryColor(s.getPrimaryColor()).bgColor(s.getBgColor())
                .build();
    }

    private String describeChanges(SiteSettings before, SiteSettings after) {
        List<String> changes = new ArrayList<>();
        diff(changes, "siteName",            before, after, SiteSettings::getSiteName);
        diff(changes, "siteDescription",     before, after, SiteSettings::getSiteDescription);
        diff(changes, "logoUrl",             before, after, SiteSettings::getLogoUrl);
        diff(changes, "copyrightText",       before, after, SiteSettings::getCopyrightText);
        diff(changes, "disclaimerText",      before, after, SiteSettings::getDisclaimerText);
        diff(changes, "footerColumnsJson",   before, after, SiteSettings::getFooterColumnsJson);
        diff(changes, "heroTitle",           before, after, SiteSettings::getHeroTitle);
        diff(changes, "heroSubtitle",        before, after, SiteSettings::getHeroSubtitle);
        diff(changes, "donateHeaderImageUrl",before, after, SiteSettings::getDonateHeaderImageUrl);
        diff(changes, "siteUrl",             before, after, SiteSettings::getSiteUrl);
        diff(changes, "banKickMessage",      before, after, SiteSettings::getBanKickMessage);
        diff(changes, "bridgeApiKey",        before, after, s -> mask(s.getBridgeApiKey()));
        diff(changes, "bridgeAllowedIp",     before, after, SiteSettings::getBridgeAllowedIp);
        diff(changes, "bridgeBackendUrl",    before, after, SiteSettings::getBridgeBackendUrl);
        diff(changes, "primaryColor",        before, after, SiteSettings::getPrimaryColor);
        diff(changes, "bgColor",             before, after, SiteSettings::getBgColor);
        return String.join(", ", changes);
    }

    private void diff(List<String> out, String name, SiteSettings a, SiteSettings b, Function<SiteSettings, String> get) {
        String oldV = get.apply(a);
        String newV = get.apply(b);
        if (!Objects.equals(oldV, newV)) {
            out.add(name + ": " + truncate(oldV) + " → " + truncate(newV));
        }
    }

    private String truncate(String s) {
        if (s == null) return "null";
        String oneLine = s.replace("\n", "⏎");
        return oneLine.length() > 40 ? oneLine.substring(0, 37) + "..." : oneLine;
    }

    private String mask(String secret) {
        if (secret == null || secret.length() < 4) return "***";
        return secret.substring(0, 4) + "…(" + secret.length() + " chars)";
    }

    private String currentActorName() {
        try {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            return auth != null ? auth.getName() : "system";
        } catch (Exception e) { return "unknown"; }
    }
}
