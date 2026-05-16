package com.craftcms.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CartItemDto {
    private Long id;
    private String type;       // PRODUCT | DONATE
    private String productType; // ITEM, BLOCK, WEAPON, ARMOR, RANK, KIT
    private String name;
    private int quantity;
    private String command;
}
