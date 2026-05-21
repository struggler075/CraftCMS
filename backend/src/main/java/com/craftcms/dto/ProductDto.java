package com.craftcms.dto;

import com.craftcms.model.ProductType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ProductDto {
    private Long id;

    @NotBlank(message = "Name is required")
    private String name;

    private String description;

    @NotNull(message = "Price is required")
    @Positive(message = "Price must be positive")
    private BigDecimal price;

    private String imageUrl;

    @NotNull(message = "Category is required")
    private Long categoryId;

    private Integer stock;
    private Boolean featured;
    private Boolean active;
    private ProductType type;
    private String command;
    private Boolean quantityEnabled;
    private Integer defaultQuantity;

    /** Server this product belongs to. Nullable = global / no specific server. */
    private Long serverId;
}
