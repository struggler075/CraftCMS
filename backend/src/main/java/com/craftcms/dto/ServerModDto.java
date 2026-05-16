package com.craftcms.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ServerModDto {
    private Long id;
    private String name;
    private String description;
    private Integer sortOrder;
}
