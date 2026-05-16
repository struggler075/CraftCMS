package com.craftcms.bridge.api.model;

public class CartItem {
    public long id;
    public String type;        // PRODUCT | DONATE
    public String productType; // ITEM, BLOCK, WEAPON, ARMOR, RANK, KIT
    public String name;
    public int quantity;
    public String command;     // null if not configured
}
