package com.craftcms.repository;

import com.craftcms.model.LauncherConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LauncherConfigRepository extends JpaRepository<LauncherConfig, Long> {
    Optional<LauncherConfig> findFirstByActiveTrueOrderByIdDesc();
}
