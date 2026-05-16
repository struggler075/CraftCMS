package com.craftcms.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ServerStatusResponse {
    private boolean online;
    private String hostname;
    private int port;
    private Players players;
    private String version;
    private Motd motd;
    private String icon;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Players {
        private int online;
        private int max;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Motd {
        private String[] clean;
        private String[] html;
    }
}
