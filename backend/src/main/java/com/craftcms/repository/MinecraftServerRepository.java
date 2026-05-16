package com.craftcms.repository;

import com.craftcms.model.MinecraftServer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MinecraftServerRepository extends JpaRepository<MinecraftServer, Long> {
    List<MinecraftServer> findByActiveTrueOrderBySortOrderAsc();
    List<MinecraftServer> findByActiveTrueAndFeaturedTrue();
}
