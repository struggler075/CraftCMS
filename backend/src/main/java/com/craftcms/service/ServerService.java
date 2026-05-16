package com.craftcms.service;

import com.craftcms.dto.PingResult;
import com.craftcms.dto.ServerModDto;
import com.craftcms.dto.ServerWithStatusDto;
import com.craftcms.model.MinecraftServer;
import com.craftcms.model.ServerMod;
import com.craftcms.ping.ServerPingService;
import com.craftcms.repository.MinecraftServerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ServerService {

    private final MinecraftServerRepository serverRepository;
    private final ServerPingService pingService;

    public List<ServerWithStatusDto> getAllWithStatus() {
        return serverRepository.findByActiveTrueOrderBySortOrderAsc()
                .stream()
                .map(this::enrichWithStatus)
                .collect(Collectors.toList());
    }

    @Transactional
    public List<MinecraftServer> getAll() {
        return serverRepository.findAll();
    }

    public MinecraftServer getById(Long id) {
        return serverRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Server not found: " + id));
    }

    @Transactional
    public MinecraftServer create(MinecraftServer server) {
        if (server.getMods() != null) {
            server.getMods().forEach(m -> m.setServer(server));
        }
        return serverRepository.save(server);
    }

    @Transactional
    public MinecraftServer update(Long id, MinecraftServer updated) {
        MinecraftServer server = getById(id);
        server.setName(updated.getName());
        server.setAddress(updated.getAddress());
        server.setDescription(updated.getDescription());
        server.setImageUrl(updated.getImageUrl());
        server.setFeatured(updated.getFeatured());
        server.setActive(updated.getActive());
        server.setSortOrder(updated.getSortOrder());
        server.setPingMethod(updated.getPingMethod());

        server.getMods().clear();
        if (updated.getMods() != null) {
            for (ServerMod mod : updated.getMods()) {
                mod.setId(null);
                mod.setServer(server);
                server.getMods().add(mod);
            }
        }

        return serverRepository.save(server);
    }

    @Transactional
    public void delete(Long id) {
        serverRepository.deleteById(id);
    }

    private ServerWithStatusDto enrichWithStatus(MinecraftServer server) {
        PingResult ping = pingService.ping(server);
        List<ServerModDto> mods = server.getMods().stream()
                .sorted(java.util.Comparator.comparingInt(m -> (m.getSortOrder() == null ? 0 : m.getSortOrder())))
                .map(m -> ServerModDto.builder()
                        .id(m.getId())
                        .name(m.getName())
                        .description(m.getDescription())
                        .sortOrder(m.getSortOrder())
                        .build())
                .collect(Collectors.toList());

        return ServerWithStatusDto.builder()
                .id(server.getId())
                .name(server.getName())
                .address(server.getAddress())
                .description(server.getDescription())
                .imageUrl(server.getImageUrl())
                .featured(server.getFeatured())
                .pingMethod(server.getPingMethod())
                .mods(mods)
                .online(ping.isOnline())
                .playersOnline(ping.getPlayersOnline())
                .playersMax(ping.getPlayersMax())
                .version(ping.getVersion())
                .motd(ping.getMotd())
                .build();
    }
}
