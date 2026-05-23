package com.craftcms.service;

import com.craftcms.model.SiteSettings;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Patches the static {@code index.html} served by nginx so that the
 * {@code <title>}, {@code og:*} meta tags, and favicon reflect the
 * current site settings without waiting for a full redeploy.
 *
 * <p>Called by {@link SiteSettingsService#update} after every successful
 * save. Failures are logged but never propagate — the site keeps working
 * even if the file can't be written (read-only FS, wrong path, etc).
 */
@Service
@Slf4j
public class IndexHtmlPatcher {

    @Value("${app.frontend.path:./frontend}")
    private String frontendPath;

    public void patch(SiteSettings settings) {
        Path index = Path.of(frontendPath, "index.html");
        if (!Files.isRegularFile(index)) {
            log.debug("index.html not found at {} — skipping patch (normal in dev)", index);
            return;
        }

        try {
            String html = Files.readString(index, StandardCharsets.UTF_8);
            String original = html;

            String name = safe(settings.getSiteName(), "CraftCMS");
            String desc = safe(settings.getSiteDescription(), "Minecraft сервер");
            String logo = safe(settings.getLogoUrl(), "/favicon.svg");
            String url  = safe(settings.getSiteUrl(), "");

            // <title>...</title>
            html = html.replaceAll("<title>[^<]*</title>", "<title>" + escHtml(name) + "</title>");

            // <meta property="og:title" content="..." />
            html = replaceMetaContent(html, "og:title", name);
            html = replaceMetaContent(html, "og:description", desc);
            html = replaceMetaContent(html, "og:image", logo);
            html = replaceMetaContent(html, "og:url", url);

            // <meta name="description" content="..." />
            html = html.replaceAll(
                    "(<meta\\s+name=\"description\"\\s+content=\")[^\"]*\"",
                    "$1" + escHtml(desc) + "\"");

            // <link rel="icon" ... href="..." />
            html = html.replaceAll(
                    "(<link\\s+rel=\"icon\"[^>]*href=\")[^\"]*\"",
                    "$1" + escHtml(logo) + "\"");

            if (!html.equals(original)) {
                Files.writeString(index, html, StandardCharsets.UTF_8);
                log.info("index.html patched: title='{}', favicon='{}'", name, logo);
            }
        } catch (IOException e) {
            log.error("Failed to patch index.html at {}: {}", index, e.getMessage());
        }
    }

    private String replaceMetaContent(String html, String property, String value) {
        return html.replaceAll(
                "(<meta\\s+property=\"" + property + "\"\\s+content=\")[^\"]*\"",
                "$1" + escHtml(value) + "\"");
    }

    private String escHtml(String s) {
        return s.replace("&", "&amp;").replace("\"", "&quot;")
                .replace("<", "&lt;").replace(">", "&gt;");
    }

    private String safe(String value, String fallback) {
        return value != null && !value.isBlank() ? value : fallback;
    }
}
