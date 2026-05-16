package com.craftcms.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PingResult {
    private boolean online;
    private int playersOnline;
    private int playersMax;
    private String version;
    private String motd;

    public static PingResult offline() {
        return PingResult.builder().online(false).build();
    }
}
