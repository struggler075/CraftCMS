package com.craftcms.controller;

import com.craftcms.model.SiteSettings;
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

    @Value("${bridge.template-jar:../BridgePlugin/target/BridgePlugin.jar}")
    private String templateJarPath;

    @Value("${server.port:8080}")
    private int serverPort;

    // ── Status ─────────────────────────────────────────────────────────────────

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        SiteSettings s = siteSettingsService.get();
        Path jar = Paths.get(templateJarPath).toAbsolutePath();
        boolean found = Files.exists(jar);
        String savedUrl = s.getBridgeBackendUrl();
        boolean isAuto  = savedUrl == null || savedUrl.isBlank();
        return ResponseEntity.ok(Map.of(
                "templateFound", found,
                "templatePath",  jar.toString(),
                "apiKey",        s.getBridgeApiKey()    != null ? s.getBridgeApiKey()    : "",
                "allowedIp",     s.getBridgeAllowedIp() != null ? s.getBridgeAllowedIp() : "",
                "backendUrl",    isAuto ? "" : savedUrl,
                "detectedUrl",   isAuto ? detectBackendUrl() : savedUrl,
                "backendUrlAuto", isAuto
        ));
    }

    // ── Generate key (server-side CSPRNG, 64-char hex = 256 bits) ─────────────

    @PostMapping("/generate-key")
    public ResponseEntity<Map<String, String>> generateKey() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        StringBuilder sb = new StringBuilder(64);
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return ResponseEntity.ok(Map.of("key", sb.toString()));
    }

    // ── Save settings ──────────────────────────────────────────────────────────

    @PutMapping("/settings")
    public ResponseEntity<Map<String, String>> saveSettings(
            @RequestBody Map<String, String> body) {
        SiteSettings patch = SiteSettings.builder().build();
        if (body.containsKey("apiKey") && !body.get("apiKey").isBlank())
            patch.setBridgeApiKey(body.get("apiKey"));
        if (body.containsKey("allowedIp"))
            patch.setBridgeAllowedIp(body.get("allowedIp"));
        if (body.containsKey("backendUrl"))
            patch.setBridgeBackendUrl(body.get("backendUrl"));
        siteSettingsService.update(patch);
        return ResponseEntity.ok(Map.of("status", "saved"));
    }

    // ── Patch and download JAR ─────────────────────────────────────────────────

    @GetMapping("/download")
    public ResponseEntity<byte[]> download() throws IOException {
        Path jar = Paths.get(templateJarPath).toAbsolutePath();
        if (!Files.exists(jar)) {
            throw new IllegalStateException(
                    "Шаблон плагина не найден: " + jar + ". Выполните 'mvn package' в папке BridgePlugin/");
        }

        SiteSettings s = siteSettingsService.get();
        String apiKey     = s.getBridgeApiKey()    != null ? s.getBridgeApiKey()    : "";
        String allowedIp  = s.getBridgeAllowedIp() != null ? s.getBridgeAllowedIp() : "";
        String savedUrl   = s.getBridgeBackendUrl();
        String backendUrl = (savedUrl != null && !savedUrl.isBlank()) ? savedUrl : detectBackendUrl();

        byte[] original = Files.readAllBytes(jar);
        byte[] patched  = patchJar(original, apiKey, allowedIp, backendUrl);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"BridgePlugin.jar\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(patched);
    }

    // ── JAR patching (ZIP manipulation) ───────────────────────────────────────

    private String detectBackendUrl() {
        return "http://localhost:" + serverPort;
    }

    // ── JAR patching (ZIP manipulation) ───────────────────────────────────────

    private static final String SECRET_ENTRY   = "bridge-secret.properties";
    private static final String KEY_PLACEHOLDER = "CRAFTCMS_BRIDGE_KEY_PLACEHOLDER";
    private static final String IP_PLACEHOLDER  = "CRAFTCMS_BRIDGE_IP_PLACEHOLDER";
    private static final String URL_PLACEHOLDER = "CRAFTCMS_BRIDGE_URL_PLACEHOLDER";

    private byte[] patchJar(byte[] original, String apiKey, String allowedIp, String backendUrl) throws IOException {
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
                            .replace(URL_PLACEHOLDER, backendUrl);
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
