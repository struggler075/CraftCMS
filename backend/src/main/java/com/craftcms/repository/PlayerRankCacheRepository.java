package com.craftcms.repository;

import com.craftcms.model.PlayerRankCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PlayerRankCacheRepository extends JpaRepository<PlayerRankCache, Long> {

    /** All active (not expired) snapshots for a player, across every server. */
    @Query("""
            SELECT p FROM PlayerRankCache p
            WHERE p.username = :username
              AND (p.expiresAt IS NULL OR p.expiresAt > :now)
            ORDER BY p.server.sortOrder ASC, p.groupName ASC
            """)
    List<PlayerRankCache> findActiveByUsername(@Param("username") String username,
                                               @Param("now") LocalDateTime now);

    Optional<PlayerRankCache> findByUsernameAndServerIdAndGroupName(
            String username, Long serverId, String groupName);

    /** Wipe every cached row for the given (player, server). Used before
     *  the plugin pushes a fresh full snapshot — keeps stale entries from
     *  sticking around after the player drops a group server-side. */
    @Modifying
    @Query("DELETE FROM PlayerRankCache p WHERE p.username = :username AND p.server.id = :serverId")
    void deleteByUsernameAndServerId(@Param("username") String username,
                                     @Param("serverId") Long serverId);

    /** Cull rows the plugin hasn't refreshed in a while — defensive cleanup
     *  for servers that disappeared without a clean sync. */
    @Modifying
    @Query("DELETE FROM PlayerRankCache p WHERE p.syncedAt < :before")
    int deleteStale(@Param("before") LocalDateTime before);
}
