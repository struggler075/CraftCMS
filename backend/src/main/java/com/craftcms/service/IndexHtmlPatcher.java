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
 * Patches the static {@code index.html} served by nginx so that bots,
 * crawlers, and link-preview engines (Telegram, Discord, VK, Google) see
 * the correct {@code <title>}, {@code og:*} meta tags, favicon, and
 * description <b>without executing JavaScript</b>.
 *
 * <p>Browser users get their values from a synchronous XHR in the HTML
 * {@code <head>} that runs before first paint — this patcher exists only
 * for non-JS consumers. Called after every settings save and on deploy.
 */
@Service
@Slf4j
public class IndexHtmlPatcher {

    @Value("${app.frontend.path:./frontend}")
    private String frontendPath;

    private static final String OG_MARKER = "<!-- og-meta -->";

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

            // 1. <title>
            html = html.replaceAll("<title>[^<]*</title>", "<title>" + esc(name) + "</title>");

            // 2. Static OG block for bots — insert or replace after </script>
            String ogBlock = OG_MARKER + "\n"
                    + "    <link rel=\"icon\" href=\"" + esc(logo) + "\">\n"
                    + "    <meta name=\"description\" content=\"" + esc(desc) + "\">\n"
                    + "    <meta property=\"og:type\" content=\"website\">\n"
                    + "    <meta property=\"og:title\" content=\"" + esc(name) + "\">\n"
                    + "    <meta property=\"og:description\" content=\"" + esc(desc) + "\">\n"
                    + "    <meta property=\"og:image\" content=\"" + esc(logo) + "\">\n"
                    + "    <meta property=\"og:url\" content=\"" + esc(url) + "\">\n"
                    + "    <!-- /og-meta -->";

            if (html.contains(OG_MARKER)) {
                html = html.replaceAll(
                        "(?s)" + OG_MARKER.replace("<!--", "<!--") + ".*?<!-- /og-meta -->",
                        ogBlock);
            } else {
                // First time — inject right before </head>
                html = html.replace("</head>", ogBlock + "\n  </head>");
            }

            if (!html.equals(original)) {
                Files.writeString(index, html, StandardCharsets.UTF_8);
                log.info("index.html patched: title='{}', favicon='{}'", name, logo);
            }
        } catch (IOException e) {
            log.error("Failed to patch index.html at {}: {}", index, e.getMessage());
        }
    }

    private static String esc(String s) {
        return s.replace("&", "&amp;").replace("\"", "&quot;")
                .replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String safe(String value, String fallback) {
        return value != null && !value.isBlank() ? value : fallback;
    }
}
