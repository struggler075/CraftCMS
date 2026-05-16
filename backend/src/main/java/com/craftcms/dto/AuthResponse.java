package com.craftcms.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String username;
    private String email;
    private String role;
    private BigDecimal balance;
    private String message;
    // primitive boolean — Java default is false, no @Builder.Default needed
    private boolean requiresVerification;
    private boolean requiresTOTP;
    private String preAuthToken;
}
