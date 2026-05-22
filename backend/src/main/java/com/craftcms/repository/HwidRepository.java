package com.craftcms.repository;

import com.craftcms.model.Hwid;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Hwid rows are written by GravitLauncher and read only when an admin needs
 * to ban/unban a hardware fingerprint or inspect a user's bound device. The
 * repository exists so that admin features can do that without resorting to
 * raw SQL — Gravit itself bypasses Spring and uses its own JDBC path.
 */
@Repository
public interface HwidRepository extends JpaRepository<Hwid, Long> {
}
