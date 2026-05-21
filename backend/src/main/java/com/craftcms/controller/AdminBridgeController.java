package com.craftcms.controller;

import com.craftcms.model.MinecraftServer;
import com.craftcms.model.SiteSettings;
import com.craftcms.repository.MinecraftServerRepository;
import com.craftcms.service.SiteSettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

@RestController
@RequestMapping("/api/admin/bridge")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminBridgeController {

    private final SiteSettingsService siteSettingsService;
    private final MinecraftServerRepository serverRepo;

    @Value("${bridge.template-jar:../BridgePlugin/target/BridgePlugin.jar}")
    private String templateJarPath;

    @Value("${server.port:8080}")
    private int serverPort;

    // ── Status ─────────────────────────────────────────────────────────────────

    /**
     * Returns status for the chosen Minecraft server. If serverId is null
     * (legacy / installs without servers yet), falls back to the global
     * SiteSettings.bridgeApiKey so old plugins keep working.
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status(@RequestParam(required = false) Long serverId) {
        SiteSettings s = siteSettingsService.get();
        Path jar = Paths.get(templateJarPath).toAbsolutePath();
        boolean found = Files.exists(jar);
        String savedUrl = s.getBridgeBackendUrl();
        boolean isAuto  = savedUrl == null || savedUrl.isBlank();

        String apiKey = "";
        String serverName = null;
        if (serverId != null) {
            MinecraftServer srv = serverRepo.findById(serverId).orElse(null);
            if (srv != null) {
                apiKey = srv.getBridgeApiKey() != null ? srv.getBridgeApiKey() : "";
                serverName = srv.getName();
            }
        } else {
            // Legacy single-server compatibility — pre-multi-server installs
            // still rely on the global key in SiteSettings.
            apiKey = s.getBridgeApiKey() != null ? s.getBridgeApiKey() : "";
        }

        Map<String, Object> out = new HashMap<>();
        out.put("templateFound", found);
        out.put("templatePath",  jar.toString());
        out.put("apiKey",        apiKey);
        out.put("serverId",      serverId);
        out.put("serverName",    serverName);
        out.put("allowedIp",     s.getBridgeAllowedIp() != null ? s.getBridgeAllowedIp() : "");
        out.put("backendUrl",    isAuto ? "" : savedUrl);
        out.put("detectedUrl",   isAuto ? detectBackendUrl() : savedUrl);
        out.put("backendUrlAuto", isAuto);
        return ResponseEntity.ok(out);
    }

    // ── Generate key (server-side CSPRNG, 64-char hex = 256 bits) ─────────────

    @PostMapping("/generate-key")
    public ResponseEntity<Map<String, String>> generateKey() {
        return ResponseEntity.ok(Map.of("key", randomHexKey()));
    }

    // ── Save settings ──────────────────────────────────────────────────────────

    /**
     * Persists the API key for a specific server (or the global one when no
     * serverId is given). allowedIp / backendUrl stay global since they're
     * usually identical across all worlds on the same host.
     */
    @PutMapping("/settings")
    public ResponseEntity<Map<String, String>> saveSettings(@RequestBody Map<String, Object> body) {
        // Single assignment so the variable is effectively final and can be
        // used inside the lambda below without javac complaining.
        final Long serverId = body.get("serverId") instanceof Number n ? n.longValue() : null;

        String apiKey    = asString(body.get("apiKey"));
        String allowedIp = asString(body.get("allowedIp"));
        String backendUrl = asString(body.get("backendUrl"));

        // Global fields (allowedIp + backendUrl) always go to SiteSettings.
        SiteSettings patch = SiteSettings.builder().build();
        if (allowedIp != null)  patch.setBridgeAllowedIp(allowedIp);
        if (backendUrl != null) patch.setBridgeBackendUrl(backendUrl);
        // Don't touch global bridgeApiKey when we've moved to per-server keys.
        siteSettingsService.update(patch);

        if (serverId != null && apiKey != null && !apiKey.isBlank()) {
            MinecraftServer srv = serverRepo.findById(serverId)
                    .orElseThrow(() -> new IllegalArgumentException("Сервер не найден: " + serverId));
            srv.setBridgeApiKey(apiKey);
            serverRepo.save(srv);
        } else if (serverId == null && apiKey != null && !apiKey.isBlank()) {
            // Legacy single-server save — keep updating the global key.
            SiteSettings p = SiteSettings.builder().bridgeApiKey(apiKey).build();
            siteSettingsService.update(p);
        }

        return ResponseEntity.ok(Map.of("status", "saved"));
    }

    // ── Patch and download JAR ─────────────────────────────────────────────────

    @GetMapping("/download")
    public ResponseEntity<byte[]> download(@RequestParam(required = false) Long serverId) throws IOException {
        Path jar = Paths.get(templateJarPath).toAbsolutePath();
        if (!Files.exists(jar)) {
            throw new IllegalStateException(
                    "Шаблон плагина не найден: " + jar + ". Выполните 'mvn package' в папке BridgePlugin/");
        }

        SiteSettings s = siteSettingsService.get();
        String apiKey;
        String serverIdStr = "";
        if (serverId != null) {
            MinecraftServer srv = serverRepo.findById(serverId)
                    .orElseThrow(() -> new IllegalArgumentException("Сервер не найден: " + serverId));
            // Auto-issue a key the first time a server has its plugin downloaded —
            // saves the admin from having to remember to click "generate" first.
            if (srv.getBridgeApiKey() == null || srv.getBridgeApiKey().isBlank()) {
                srv.setBridgeApiKey(randomHexKey());
                serverRepo.save(srv);
            }
            apiKey = srv.getBridgeApiKey();
            serverIdStr = srv.getId().toString();
        } else {
            apiKey = s.getBridgeApiKey() != null ? s.getBridgeApiKey() : "";
        }
        String allowedIp  = s.getBridgeAllowedIp() != null ? s.getBridgeAllowedIp() : "";
        String savedUrl   = s.getBridgeBackendUrl();
        String backendUrl = (savedUrl != null && !savedUrl.isBlank()) ? savedUrl : detectBackendUrl();

        byte[] original = Files.readAllBytes(jar);
        byte[] patched  = patchJar(original, apiKey, allowedIp, backendUrl, serverIdStr);

        String filename = serverId != null
                ? "BridgePlugin-server" + serverIdStr + ".jar"
                : "BridgePlugin.jar";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(patched);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String detectBackendUrl() {
        return "http://localhost:" + serverPort;
    }

    private static String randomHexKey() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        StringBuilder sb = new StringBuilder(64);
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private static String asString(Object v) {
        return v == null ? null : v.toString();
    }

    // ── JAR patching (ZIP manipulation) ───────────────────────────────────────

    private static final String SECRET_ENTRY        = "bridge-secret.properties";
    private static final String KEY_PLACEHOLDER     = "CRAFTCMS_BRIDGE_KEY_PLACEHOLDER";
    private static final String IP_PLACEHOLDER      = "CRAFTCMS_BRIDGE_IP_PLACEHOLDER";
    private static final String URL_PLACEHOLDER     = "CRAFTCMS_BRIDGE_URL_PLACEHOLDER";
    /** New placeholder for multi-server support — written into bridge-secret.properties
     *  alongside the key. Empty when legacy/global mode is in use. */
    private static final String SERVER_ID_PLACEHOLDER = "CRAFTCMS_BRIDGE_SERVER_ID_PLACEHOLDER";

    private byte[] patchJar(byte[] original, String apiKey, String allowedIp,
                            String backendUrl, String serverId) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipInputStream  zis = new ZipInputStream(new ByteArrayInputStream(original));
             ZipOutputStream zos = new ZipOutputStream(baos)) {

            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                zos.putNextEntry(new ZipEntry(entry.getName()));

                if (SECRET_ENTRY.equals(entry.getName())) {
                    String content = new String(zis.readAllBytes(), StandardCharsets.UTF_8);
                    content = content
                            .replace(KEY_PLACEHOLDER, apiKey)
                            .replace(IP_PLACEHOLDER,  allowedIp)
                            .replace(URL_PLACEHOLDER, backendUrl)
                            .replace(SERVER_ID_PLACEHOLDER, serverId);
                    // If the placeholder isn't in the template yet (old build), append it.
                    if (!content.contains("server.id=")) {
                        content += "\nserver.id=" + serverId + "\n";
                    }
                    zos.write(content.getBytes(StandardCharsets.UTF_8));
                } else {
                    byte[] buf = new byte[8192];
                    int len;
                    while ((len = zis.read(buf)) != -1) zos.write(buf, 0, len);
                }
                zos.closeEntry();
            }
        }
        return baos.toByteArray();
    }
}
