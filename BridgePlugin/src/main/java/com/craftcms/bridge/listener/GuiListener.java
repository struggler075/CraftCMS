package com.craftcms.bridge.listener;

import com.craftcms.bridge.BridgePlugin;
import com.craftcms.bridge.gui.CartGui;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;

public class GuiListener implements Listener {

    private final BridgePlugin plugin;

    public GuiListener(BridgePlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler
    public void onInventoryClick(InventoryClickEvent event) {
        if (!(event.getWhoClicked() instanceof Player)) return;
        Player player = (Player) event.getWhoClicked();

        CartGui gui = plugin.getGuiManager().get(player);
        if (gui == null) return;

        event.setCancelled(true); // cancel ALL clicks in our GUI

        if (event.getRawSlot() < 0 || event.getRawSlot() >= 54) return;
        gui.handleClick(event.getRawSlot());
    }

    @EventHandler
    public void onInventoryClose(InventoryCloseEvent event) {
        if (!(event.getPlayer() instanceof Player)) return;
        plugin.getGuiManager().remove((Player) event.getPlayer());
    }
}
