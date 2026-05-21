package com.craftcms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Snapshot of a player's active LuckPerms groups, pushed by the Minecraft
 * plugin. The backend keeps this row up to date and serves it to the
 * profile page — no expiration logic here, the plugin is the source of truth.
 */
@Entity
@Table(name = "player_rank_cache", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"username", "server_id", "groupName"})
}, indexes = {
        @Index(name = "idx_prc_username", columnList = "username"),
        @Index(name = "idx_prc_server", columnList = "server_id"),
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlayerRankCache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Minecraft username — denormalised so we don't need a Users FK. */
    @Column(nullable = false, length = 64)
    private String username;

    /** Server this snapshot is from — identified by the plugin's API key. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "server_id", nullable = false)
    private MinecraftServer server;

    /** LuckPerms group name (e.g. "vip", "premium"). */
    @Column(nullable = false, length = 64)
    private String groupName;

    /**
     * Optional pretty name + color. If the rank name matches an entry in
     * the CMS DonateRank table we resolve them at read time, but the plugin
     * may also send them straight from LuckPerms display-name meta.
     */
    @Column(length = 64)
    private String displayName;

    @Column(length = 16)
    private String color;

    /** NULL = permanent; otherwise the moment the LP node expires. */
    private LocalDateTime expiresAt;

    /** When the plugin last refreshed this row. Stale rows can be culled. */
    @Column(nullable = false)
    private LocalDateTime syncedAt;
}
