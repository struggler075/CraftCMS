package com.craftcms.bridge.command;

import com.craftcms.bridge.BridgePlugin;
import com.craftcms.bridge.api.model.CartItem;
import com.craftcms.bridge.gui.CartGui;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.scheduler.BukkitRunnable;

import java.util.List;

public class CartCommand implements CommandExecutor {

    private final BridgePlugin plugin;

    public CartCommand(BridgePlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player)) {
            sender.sendMessage(ChatColor.RED + "Команда только для игроков.");
            return true;
        }

        Player player = (Player) sender;
        player.sendMessage(ChatColor.GRAY + "Загрузка корзины...");

        new BukkitRunnable() {
            @Override
            public void run() {
                try {
                    List<CartItem> items = plugin.getApi().getCart(player.getName());
                    plugin.onRequestSuccess();
                    new BukkitRunnable() {
                        @Override
                        public void run() {
                            if (items.isEmpty()) {
                                player.sendMessage(ChatColor.YELLOW + "Ваша корзина пуста. Купите что-нибудь в магазине!");
                                return;
                            }
                            new CartGui(plugin, player, items).open();
                        }
                    }.runTask(plugin);
                } catch (Exception e) {
                    plugin.onRequestFailure("cart:" + player.getName(), e);
                    new BukkitRunnable() {
                        @Override
                        public void run() {
                            player.sendMessage(ChatColor.RED + "Сайт временно недоступен. Попробуйте позже.");
                        }
                    }.runTask(plugin);
                }
            }
        }.runTaskAsynchronously(plugin);

        return true;
    }
}
