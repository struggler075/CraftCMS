package com.craftcms.repository;

import com.craftcms.model.DonateRank;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DonateRankRepository extends JpaRepository<DonateRank, Long> {
    List<DonateRank> findAllByOrderBySortOrderAsc();

    /**
     * Per-server listing — ranks of this server PLUS global ranks (server IS NULL).
     * Global ranks appear on every server's donate page so the admin can ship
     * cross-server perks without having to duplicate every rank per world.
     */
    @Query("""
            SELECT r FROM DonateRank r
            WHERE (r.server.id = :serverId OR r.server IS NULL)
            ORDER BY r.sortOrder ASC
            """)
    List<DonateRank> findForServerOrdered(@Param("serverId") Long serverId);
}
