package com.craftcms.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Singleton entity — by design exactly one row exists with id=1.
 * The CHECK constraint guarantees no second row can ever be inserted,
 * even by hand from psql. {@link com.craftcms.service.SiteSettingsService}
 * always reads/writes that single row.
 */
@Entity
@Table(
        name = "site_settings",
        uniqueConstraints = @UniqueConstraint(name = "uq_site_settings_singleton", columnNames = "id")
)
@org.hibernate.annotations.Check(constraints = "id = 1")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SiteSettings {

    @Id
    @Builder.Default
    @JsonIgnore
    private Long id = 1L;

    @Builder.Default
    private String siteName = "CraftCMS";

    @Builder.Default
    @Column(columnDefinition = "TEXT")
    private String siteDescription = "Лучший Minecraft опыт. Уникальные режимы, магазин привилегий и активное сообщество.";

    // optional — if set, used instead of the default icon in Navbar/Footer
    private String logoUrl;

    @Builder.Default
    private String copyrightText = "Все права защищены.";

    @Builder.Default
    private String disclaimerText = "Not affiliated with Mojang Studios";

    private String donateHeaderImageUrl;

    @Builder.Default
    private String siteUrl = "http://localhost:5173";

    @Builder.Default
    private boolean emailVerificationRequired = false;

    @Builder.Default
    @Column(columnDefinition = "TEXT")
    private String banKickMessage = "§cВы заблокированы на этом сервере.\n§7Причина: §f{reason}";

    @Builder.Default
    private String bridgeApiKey = "change-me";

    @Builder.Default
    private String bridgeAllowedIp = "";

    @Builder.Default
    private String bridgeBackendUrl = "";

    @Builder.Default
    private String primaryColor = "#7c3aed";

    @Builder.Default
    private String bgColor = "#0a0a0f";

    @Builder.Default
    private String heroTitle = "Модовый проект нового уровня";

    @Builder.Default
    @Column(columnDefinition = "TEXT")
    private String heroSubtitle = "Уникальная сборка модов, балансный геймплей и активное сообщество. Скачайте лаунчер и начните играть за несколько минут.";

    // JSON array: [{title, links: [{label, href}]}]
    @Builder.Default
    @Column(columnDefinition = "TEXT")
    private String footerColumnsJson = """
            [
              {"title":"Навигация","links":[{"label":"Главная","href":"/"},{"label":"Магазин","href":"/shop"},{"label":"Лаунчер","href":"/launcher"}]},
              {"title":"Поддержка","links":[{"label":"Discord","href":"#"},{"label":"VK","href":"#"},{"label":"Правила","href":"#"},{"label":"Контакты","href":"#"}]}
            ]""";

    // ── License / GitHub integration ─────────────────────────────────────────
    // Exposed only through /api/admin/updates — never returned in the public
    // /api/settings response. @JsonIgnore suppresses both serialization and
    // deserialization so the general settings PUT cannot overwrite this field.
    @JsonIgnore
    @Column(name = "github_token", columnDefinition = "TEXT")
    private String githubToken;

    /**
     * Optimistic-lock token. Two admins editing the settings simultaneously will
     * now get a deterministic 409 instead of silently clobbering each other.
     * Hibernate manages this column automatically — never set it by hand.
     */
    @Version
    @Builder.Default
    @JsonIgnore
    @Column(nullable = false, columnDefinition = "bigint default 0")
    private Long version = 0L;

    /**
     * Stamped on every save. Used by the hourly backup task to skip dumping
     * an identical snapshot, and surfaced in the audit log for diff context.
     */
    @Builder.Default
    @JsonIgnore
    private Instant updatedAt = Instant.now();
}
