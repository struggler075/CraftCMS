package com.craftcms.repository;

import com.craftcms.model.MinecraftServer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

import java.util.Optional;

@Repository
public interface MinecraftServerRepository extends JpaRepository<MinecraftServer, Long> {
    List<MinecraftServer> findByActiveTrueOrderBySortOrderAsc();
    List<MinecraftServer> findByActiveTrueAndFeaturedTrue();

    /** Used by BridgeController to identify which server a plugin request came from. */
    Optional<MinecraftServer> findByBridgeApiKey(String bridgeApiKey);
}
