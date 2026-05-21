package com.craftcms.dto;

import com.craftcms.model.OrderStatus;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class OrderDto {
    private Long id;
    private String productName;
    private String productImageUrl;
    private String categoryName;
    private Integer quantity;
    private BigDecimal totalPrice;
    private OrderStatus status;
    private LocalDateTime createdAt;
    /** Server the product was bought for, null if it's a global item. */
    private Long serverId;
    private String serverName;
}
