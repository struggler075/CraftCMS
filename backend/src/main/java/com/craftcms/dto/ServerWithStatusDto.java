package com.craftcms.dto;

import com.craftcms.model.PingMethod;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ServerWithStatusDto {
    private Long id;
    private String name;
    private String address;
    private String description;
    private String imageUrl;
    private Boolean featured;
    private PingMethod pingMethod;
    private List<ServerModDto> mods;

    // Live status
    private boolean online;
    private int playersOnline;
    private int playersMax;
    private String version;
    private String motd;
}
