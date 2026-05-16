package com.craftcms.bridge.listener;

import com.craftcms.bridge.BridgePlugin;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerPreLoginEvent;

public class JoinListener implements Listener {

    private final BridgePlugin plugin;

    public JoinListener(BridgePlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.HIGH)
    public void onPreLogin(AsyncPlayerPreLoginEvent event) {
        if (!plugin.getConfig().getBoolean("ban-check-enabled", true)) return;

        try {
            String kickMessage = plugin.getApi().checkBan(event.getName());
            plugin.onRequestSuccess();
            if (kickMessage != null) {
                String formatted = kickMessage.replace("\\n", "\n");
                event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_BANNED, formatted);
            }
        } catch (Exception e) {
            // API unavailable — allow join (fail-open policy)
            plugin.onRequestFailure("ban-check:" + event.getName(), e);
        }
    }
}
