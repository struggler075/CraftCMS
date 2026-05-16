package com.craftcms.bridge.gui;

import org.bukkit.entity.Player;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class GuiManager {

    private final Map<UUID, CartGui> openGuis = new HashMap<>();

    public void register(Player player, CartGui gui) {
        openGuis.put(player.getUniqueId(), gui);
    }

    public CartGui get(Player player) {
        return openGuis.get(player.getUniqueId());
    }

    public void remove(Player player) {
        openGuis.remove(player.getUniqueId());
    }
}
