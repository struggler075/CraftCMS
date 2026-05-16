package com.craftcms.bridge.gui;

import com.craftcms.bridge.BridgePlugin;
import com.craftcms.bridge.api.model.CartItem;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.scheduler.BukkitRunnable;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class CartGui {

    private static final int PAGE_SIZE = 45;
    private static final int INV_SIZE  = 54;

    private final BridgePlugin plugin;
    private final Player player;
    private final List<CartItem> items;
    private int page;

    // slot → CartItem for click handling
    private final CartItem[] slotMap = new CartItem[INV_SIZE];

    public CartGui(BridgePlugin plugin, Player player, List<CartItem> items) {
        this(plugin, player, items, 0);
    }

    public CartGui(BridgePlugin plugin, Player player, List<CartItem> items, int page) {
        this.plugin = plugin;
        this.player = player;
        this.items  = items;
        this.page   = page;
    }

    public void open() {
        int totalPages = Math.max(1, (int) Math.ceil((double) items.size() / PAGE_SIZE));
        if (page >= totalPages) page = totalPages - 1;

        String title = plugin.getConfig().getString("cart-title", "§6Корзина покупок")
                + " §8(" + items.size() + ")";
        Inventory inv = Bukkit.createInventory(null, INV_SIZE, title);

        Arrays.fill(slotMap, null);

        // ── Item slots 0-44 ───────────────────────────────────────────────────
        int start = page * PAGE_SIZE;
        int end   = Math.min(start + PAGE_SIZE, items.size());

        for (int i = start; i < end; i++) {
            int slot = i - start;
            CartItem ci = items.get(i);
            inv.setItem(slot, buildCartItem(ci));
            slotMap[slot] = ci;
        }

        // ── Navigation row (slots 45-53) ──────────────────────────────────────
        // Fill nav bar with glass pane
        ItemStack filler = buildFiller();
        for (int s = 45; s < 54; s++) inv.setItem(s, filler);

        // Previous page (slot 45)
        if (page > 0) inv.setItem(45, buildNavItem(Material.ARROW, "§e§l← Назад", "§7Страница " + page + "/" + totalPages));

        // Page info (slot 49)
        inv.setItem(49, buildNavItem(Material.PAPER,
                "§fСтраница §e" + (page + 1) + "§7/§e" + totalPages,
                "§7Всего товаров: §f" + items.size(),
                "§7Нажми на товар §fдля получения"));

        // Next page (slot 53)
        if (page < totalPages - 1) inv.setItem(53, buildNavItem(Material.ARROW, "§e§lВперёд →", "§7Страница " + (page + 2) + "/" + totalPages));

        // Register in manager BEFORE opening
        plugin.getGuiManager().register(player, this);
        player.openInventory(inv);
    }

    /** Called when player clicks a slot. Returns true if handled. */
    public boolean handleClick(int slot) {
        if (slot >= 45) {
            // Navigation
            if (slot == 45 && page > 0)   { reopen(page - 1); return true; }
            if (slot == 53)               { reopen(page + 1); return true; }
            return true; // block all nav-row clicks
        }

        CartItem ci = slotMap[slot];
        if (ci == null) return false;

        if (ci.command == null || ci.command.isEmpty()) {
            player.sendMessage(ChatColor.RED + "Для этого товара не настроена команда выдачи. Обратитесь к администратору.");
            return true;
        }

        // Close inventory first
        player.closeInventory();

        // Async claim
        new BukkitRunnable() {
            @Override
            public void run() {
                try {
                    String cmd = plugin.getApi().claimItem(player.getName(), ci.type, ci.id);
                    new BukkitRunnable() {
                        @Override
                        public void run() {
                            if (!cmd.isEmpty()) {
                                Bukkit.dispatchCommand(Bukkit.getConsoleSender(), cmd);
                            }
                            player.sendMessage(ChatColor.GREEN + "✔ " + ChatColor.WHITE + ci.name + ChatColor.GRAY + " — выдано!");
                            // Refresh cart
                            refreshCart();
                        }
                    }.runTask(plugin);
                } catch (Exception e) {
                    new BukkitRunnable() {
                        @Override
                        public void run() {
                            player.sendMessage(ChatColor.RED + "Ошибка получения товара: " + e.getMessage());
                        }
                    }.runTask(plugin);
                }
            }
        }.runTaskAsynchronously(plugin);

        return true;
    }

    private void reopen(int newPage) {
        player.closeInventory();
        new BukkitRunnable() {
            @Override
            public void run() {
                new CartGui(plugin, player, items, newPage).open();
            }
        }.runTask(plugin);
    }

    /** Re-fetches cart from API and reopens. */
    private void refreshCart() {
        new BukkitRunnable() {
            @Override
            public void run() {
                try {
                    List<CartItem> fresh = plugin.getApi().getCart(player.getName());
                    new BukkitRunnable() {
                        @Override
                        public void run() {
                            new CartGui(plugin, player, fresh, 0).open();
                        }
                    }.runTask(plugin);
                } catch (Exception e) {
                    // Silently ignore refresh failure
                }
            }
        }.runTaskAsynchronously(plugin);
    }

    // ── ItemStack builders ────────────────────────────────────────────────────

    private ItemStack buildCartItem(CartItem ci) {
        Material mat = getMaterial(ci.productType);
        ItemStack stack = new ItemStack(mat, Math.max(1, ci.quantity));
        ItemMeta meta = stack.getItemMeta();
        if (meta == null) return stack;

        meta.setDisplayName(ChatColor.WHITE + "" + ChatColor.BOLD + ci.name);

        List<String> lore = new ArrayList<>();
        lore.add(ChatColor.GRAY + "Тип: " + ChatColor.WHITE + formatType(ci.type, ci.productType));
        lore.add(ChatColor.GRAY + "Количество: " + ChatColor.WHITE + ci.quantity);
        lore.add("");
        if (ci.command != null && !ci.command.isEmpty()) {
            lore.add(ChatColor.GREEN + "▶ Нажми для получения");
        } else {
            lore.add(ChatColor.RED + "✘ Команда не настроена");
        }
        meta.setLore(lore);
        stack.setItemMeta(meta);
        return stack;
    }

    private ItemStack buildNavItem(Material mat, String name, String... loreLines) {
        ItemStack stack = new ItemStack(mat);
        ItemMeta meta = stack.getItemMeta();
        if (meta == null) return stack;
        meta.setDisplayName(name);
        meta.setLore(Arrays.asList(loreLines));
        stack.setItemMeta(meta);
        return stack;
    }

    private ItemStack buildFiller() {
        try {
            // GRAY_STAINED_GLASS_PANE in 1.13+, STAINED_GLASS_PANE in 1.8-1.12
            Material m = getMaterialSafe("GRAY_STAINED_GLASS_PANE", "STAINED_GLASS_PANE");
            ItemStack glass = new ItemStack(m);
            ItemMeta meta = glass.getItemMeta();
            if (meta != null) { meta.setDisplayName(" "); glass.setItemMeta(meta); }
            return glass;
        } catch (Exception e) {
            return new ItemStack(Material.PAPER);
        }
    }

    private Material getMaterial(String productType) {
        if (productType == null) return Material.PAPER;
        switch (productType.toUpperCase()) {
            case "WEAPON":      return getMaterialSafe("DIAMOND_SWORD", "IRON_SWORD");
            case "ARMOR":       return getMaterialSafe("DIAMOND_CHESTPLATE", "IRON_CHESTPLATE");
            case "RANK":        return Material.NETHER_STAR;
            case "KIT":         return getMaterialSafe("CHEST", "PAPER");
            case "BLOCK":       return getMaterialSafe("BRICKS", "PAPER");
            case "CURRENCY":    return getMaterialSafe("GOLD_INGOT", "PAPER");
            default:            return Material.PAPER;
        }
    }

    private Material getMaterialSafe(String... names) {
        for (String name : names) {
            try {
                Material m = Material.valueOf(name);
                if (m != null && m != Material.AIR) return m;
            } catch (IllegalArgumentException ignored) {}
        }
        return Material.PAPER;
    }

    private String formatType(String type, String productType) {
        if ("DONATE".equals(type)) return "Донат-ранг";
        if (productType == null) return "Товар";
        switch (productType.toUpperCase()) {
            case "WEAPON": return "Оружие";
            case "ARMOR":  return "Броня";
            case "RANK":   return "Ранг";
            case "KIT":    return "Кит";
            case "BLOCK":  return "Блок";
            default:       return "Предмет";
        }
    }
}
