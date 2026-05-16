package com.craftcms.bridge;

import com.craftcms.bridge.api.BridgeApi;
import com.craftcms.bridge.command.CartCommand;
import com.craftcms.bridge.gui.GuiManager;
import com.craftcms.bridge.listener.GuiListener;
import com.craftcms.bridge.listener.JoinListener;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

public class BridgePlugin extends JavaPlugin {

    private BridgeApi api;
    private GuiManager guiManager;
    private volatile boolean connected = false;

    @Override
    public void onEnable() {
        saveDefaultConfig();

        String cfgBaseUrl = getConfig().getString("base-url", "http://localhost:8080");
        String cfgKey     = getConfig().getString("api-key", "change-me");
        // bridge-secret.properties is patched by the admin panel on download.
        // If placeholders are present (manual/dev build), fall back to config.yml values.
        String baseUrl = readSecret("base-url", cfgBaseUrl);
        String apiKey  = readSecret("api-key",  cfgKey);

        if ("change-me".equals(apiKey) || apiKey.contains("PLACEHOLDER")) {
            getLogger().warning("==============================================");
            getLogger().warning(" API key is not configured!");
            getLogger().warning(" Download the plugin via Admin -> Server Plugin.");
            getLogger().warning("==============================================");
        }

        api = new BridgeApi(baseUrl, apiKey);
        guiManager = new GuiManager();

        // Register commands
        CartCommand cartCmd = new CartCommand(this);
        getCommand("cart").setExecutor(cartCmd);

        // Register listeners
        getServer().getPluginManager().registerEvents(new JoinListener(this), this);
        getServer().getPluginManager().registerEvents(new GuiListener(this), this);

        getLogger().info("BridgePlugin enabled. Backend: " + baseUrl);

        // Initial ping async
        final String urlRef = baseUrl;
        new Thread(() -> {
            if (api.ping()) {
                connected = true;
                getLogger().info("[OK] Backend is reachable: " + urlRef);
            } else {
                connected = false;
                getLogger().warning("[FAIL] Backend is not reachable: " + urlRef);
                getLogger().warning("       Make sure the site is running and the api-key is correct.");
            }
        }, "bridge-ping").start();

        // Reconnect task: every 30 seconds if disconnected
        getServer().getScheduler().runTaskTimerAsynchronously(this, () -> {
            if (!connected) {
                if (api.ping()) {
                    connected = true;
                    getLogger().info("[OK] Backend connection restored: " + urlRef);
                }
            }
        }, 600L, 600L); // 600 ticks = 30 seconds
    }

    @Override
    public void onDisable() {
        getLogger().info("BridgePlugin disabled.");
    }

    public BridgeApi getApi() { return api; }
    public GuiManager getGuiManager() { return guiManager; }
    public boolean isConnected() { return connected; }

    public void onRequestSuccess() {
        if (!connected) {
            connected = true;
            getLogger().info("[OK] Backend connection restored.");
        }
    }

    public void onRequestFailure(String context, Exception e) {
        if (connected) {
            connected = false;
            getLogger().warning("[FAIL] Backend became unreachable (" + context + "): " + e.getMessage());
        }
    }

    private String readSecret(String key, String fallback) {
        try (InputStream is = getClass().getResourceAsStream("/bridge-secret.properties")) {
            if (is == null) return fallback;
            Properties p = new Properties();
            p.load(is);
            String val = p.getProperty(key, fallback);
            // If the placeholder was never patched, use fallback
            return (val != null && !val.contains("PLACEHOLDER")) ? val : fallback;
        } catch (IOException e) {
            return fallback;
        }
    }
}
