package com.craftcms.controller;

import com.craftcms.model.LauncherConfig;
import com.craftcms.repository.LauncherConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
public class LauncherController {

    private final LauncherConfigRepository launcherConfigRepository;

    @GetMapping("/api/launcher")
    public ResponseEntity<?> getLauncher() {
        return launcherConfigRepository.findFirstByActiveTrueOrderByIdDesc()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/admin/launcher")
    public ResponseEntity<LauncherConfig> updateLauncher(@RequestBody Map<String, String> body) {
        LauncherConfig config = launcherConfigRepository.findFirstByActiveTrueOrderByIdDesc()
                .orElse(LauncherConfig.builder().build());

        if (body.containsKey("version")) config.setVersion(body.get("version"));
        if (body.containsKey("description")) config.setDescription(body.get("description"));
        if (body.containsKey("windowsUrl")) config.setWindowsUrl(body.get("windowsUrl"));
        if (body.containsKey("linuxUrl")) config.setLinuxUrl(body.get("linuxUrl"));
        if (body.containsKey("macUrl")) config.setMacUrl(body.get("macUrl"));
        config.setActive(true);

        return ResponseEntity.ok(launcherConfigRepository.save(config));
    }
}
