package com.craftcms.repository;

import com.craftcms.model.AuditAction;
import com.craftcms.model.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    @Query("""
            SELECT a FROM AuditLog a
            WHERE (:action      IS NULL OR a.action      = :action)
              AND (:actorId     IS NULL OR a.actorId     = :actorId)
              AND (:targetId    IS NULL OR a.targetId    = :targetId)
              AND (:from        IS NULL OR a.timestamp  >= :from)
              AND (:to          IS NULL OR a.timestamp  <= :to)
              AND (:search      IS NULL
                   OR LOWER(a.actorUsername)  LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(a.targetUsername) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(a.details)        LIKE LOWER(CONCAT('%', :search, '%')))
            ORDER BY a.timestamp DESC
            """)
    Page<AuditLog> search(@Param("action") AuditAction action,
                          @Param("actorId") Long actorId,
                          @Param("targetId") Long targetId,
                          @Param("from") LocalDateTime from,
                          @Param("to") LocalDateTime to,
                          @Param("search") String search,
                          Pageable pageable);
}
