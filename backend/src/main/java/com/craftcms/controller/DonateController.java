package com.craftcms.controller;

import com.craftcms.model.DonateFeature;
import com.craftcms.model.DonateRank;
import com.craftcms.model.MinecraftServer;
import com.craftcms.repository.DonateFeatureRepository;
import com.craftcms.repository.DonateRankRepository;
import com.craftcms.repository.MinecraftServerRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class DonateController {

    private final DonateRankRepository rankRepo;
    private final DonateFeatureRepository featureRepo;
    private final MinecraftServerRepository serverRepo;
    private final ObjectMapper objectMapper;

    // ── DTOs ──────────────────────────────────────────────────────────────────

    record FeatureDto(Long id, String name, int sortOrder) {}

    record RankDto(Long id, String name, String color, String imageUrl,
                   int price, String buyLink, int sortOrder, boolean featured,
                   List<Long> featureIds,
                   Long serverId, String serverName) {}

    record PageDto(List<RankDto> ranks, List<FeatureDto> features) {}

    record FeatureRequest(String name, int sortOrder) {}

    record RankRequest(String name, String color, String imageUrl,
                       int price, String buyLink, int sortOrder, boolean featured,
                       List<Long> featureIds,
                       Long serverId) {}

    // ── Public ────────────────────────────────────────────────────────────────

    @GetMapping("/api/donate")
    public PageDto getPage(@RequestParam(required = false) Long serverId) {
        var features = featureRepo.findAllByOrderBySortOrderAsc()
                .stream().map(f -> new FeatureDto(f.getId(), f.getName(), f.getSortOrder())).toList();
        var ranks = (serverId != null
                ? rankRepo.findByServerIdOrderBySortOrderAsc(serverId)
                : rankRepo.findAllByOrderBySortOrderAsc())
                .stream().map(this::toDto).toList();
        return new PageDto(ranks, features);
    }

    // ── Admin – Features ──────────────────────────────────────────────────────

    @GetMapping("/api/admin/donate/features")
    @PreAuthorize("hasRole('ADMIN')")
    public List<FeatureDto> getFeatures() {
        return featureRepo.findAllByOrderBySortOrderAsc()
                .stream().map(f -> new FeatureDto(f.getId(), f.getName(), f.getSortOrder())).toList();
    }

    @PostMapping("/api/admin/donate/features")
    @PreAuthorize("hasRole('ADMIN')")
    public FeatureDto createFeature(@RequestBody FeatureRequest req) {
        var f = featureRepo.save(DonateFeature.builder().name(req.name()).sortOrder(req.sortOrder()).build());
        return new FeatureDto(f.getId(), f.getName(), f.getSortOrder());
    }

    @PutMapping("/api/admin/donate/features/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public FeatureDto updateFeature(@PathVariable Long id, @RequestBody FeatureRequest req) {
        var f = featureRepo.findById(id).orElseThrow();
        f.setName(req.name()); f.setSortOrder(req.sortOrder());
        featureRepo.save(f);
        return new FeatureDto(f.getId(), f.getName(), f.getSortOrder());
    }

    @DeleteMapping("/api/admin/donate/features/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteFeature(@PathVariable Long id) { featureRepo.deleteById(id); }

    // ── Admin – Ranks ─────────────────────────────────────────────────────────

    @GetMapping("/api/admin/donate/ranks")
    @PreAuthorize("hasRole('ADMIN')")
    public List<RankDto> getRanks() {
        return rankRepo.findAllByOrderBySortOrderAsc().stream().map(this::toDto).toList();
    }

    @PostMapping("/api/admin/donate/ranks")
    @PreAuthorize("hasRole('ADMIN')")
    public RankDto createRank(@RequestBody RankRequest req) {
        var r = DonateRank.builder()
                .name(req.name()).color(req.color() != null ? req.color() : "#7c3aed")
                .imageUrl(req.imageUrl()).price(req.price()).buyLink(req.buyLink())
                .sortOrder(req.sortOrder()).featured(req.featured())
                .featureIdsJson(toJson(req.featureIds()))
                .server(resolveServer(req.serverId()))
                .build();
        return toDto(rankRepo.save(r));
    }

    @PutMapping("/api/admin/donate/ranks/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public RankDto updateRank(@PathVariable Long id, @RequestBody RankRequest req) {
        var r = rankRepo.findById(id).orElseThrow();
        r.setName(req.name());
        if (req.color() != null) r.setColor(req.color());
        r.setImageUrl(req.imageUrl()); r.setPrice(req.price()); r.setBuyLink(req.buyLink());
        r.setSortOrder(req.sortOrder()); r.setFeatured(req.featured());
        r.setFeatureIdsJson(toJson(req.featureIds()));
        r.setServer(resolveServer(req.serverId()));
        return toDto(rankRepo.save(r));
    }

    @DeleteMapping("/api/admin/donate/ranks/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteRank(@PathVariable Long id) { rankRepo.deleteById(id); }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private RankDto toDto(DonateRank r) {
        MinecraftServer s = r.getServer();
        return new RankDto(r.getId(), r.getName(), r.getColor(), r.getImageUrl(),
                r.getPrice(), r.getBuyLink(), r.getSortOrder(), r.isFeatured(),
                parseIds(r.getFeatureIdsJson()),
                s != null ? s.getId() : null,
                s != null ? s.getName() : null);
    }

    /** null → no server; unknown id → null (don't crash). */
    private MinecraftServer resolveServer(Long serverId) {
        if (serverId == null) return null;
        return serverRepo.findById(serverId).orElse(null);
    }

    private List<Long> parseIds(String json) {
        try { return objectMapper.readValue(json, new TypeReference<>() {}); }
        catch (Exception e) { return List.of(); }
    }

    private String toJson(List<Long> ids) {
        try { return objectMapper.writeValueAsString(ids != null ? ids : List.of()); }
        catch (Exception e) { return "[]"; }
    }
}
