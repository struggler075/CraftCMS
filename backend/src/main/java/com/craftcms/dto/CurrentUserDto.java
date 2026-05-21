package com.craftcms.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/** Lightweight payload returned by /api/auth/me — single source of truth for the SPA. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CurrentUserDto {
    private Long id;
    private String username;
    private String email;
    private String role;
    private BigDecimal balance;
    private boolean emailVerified;
    private boolean blocked;
    private String skinUrl;
    private String capeUrl;
}
