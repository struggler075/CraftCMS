package com.craftcms.dto;

import com.craftcms.model.PaymentProvider;
import com.craftcms.model.TopUpOrder;
import com.craftcms.model.TopUpStatus;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class TopUpOrderDto {
    private String id;
    private String username;
    private BigDecimal amount;
    private PaymentProvider provider;
    private TopUpStatus status;
    private String externalId;
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;

    public static TopUpOrderDto from(TopUpOrder o) {
        TopUpOrderDto dto = new TopUpOrderDto();
        dto.id = o.getId();
        dto.username = o.getUser() != null ? o.getUser().getUsername() : null;
        dto.amount = o.getAmount();
        dto.provider = o.getProvider();
        dto.status = o.getStatus();
        dto.externalId = o.getExternalId();
        dto.createdAt = o.getCreatedAt();
        dto.completedAt = o.getCompletedAt();
        return dto;
    }
}
