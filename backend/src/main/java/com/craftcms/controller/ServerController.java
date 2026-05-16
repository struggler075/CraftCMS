package com.craftcms.controller;

import com.craftcms.dto.ServerWithStatusDto;
import com.craftcms.service.ServerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/servers")
@RequiredArgsConstructor
public class ServerController {

    private final ServerService serverService;

    @GetMapping
    public ResponseEntity<List<ServerWithStatusDto>> getAll() {
        return ResponseEntity.ok(serverService.getAllWithStatus());
    }
}
