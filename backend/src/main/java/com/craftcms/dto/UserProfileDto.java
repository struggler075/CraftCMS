package com.craftcms.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class UserProfileDto {
    private Long id;
    private String username;
    private String email;
    private String role;
    private BigDecimal balance;
    private LocalDateTime createdAt;
    private long totalOrders;
    private String skinUrl;
    private String capeUrl;
    private boolean emailVerified;
}
