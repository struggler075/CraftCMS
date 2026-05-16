package com.craftcms.ping;

import com.craftcms.dto.PingResult;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
@RequiredArgsConstructor
@Slf4j
public class McstatusPingAdapter implements ServerPingAdapter {

    private static final String BASE = "https://api.mcstatus.io/v2/status/java/";

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Override
    public PingResult ping(String address) {
        try {
            String url = BASE + address;
            String body = restTemplate.getForObject(url, String.class);
            Response r = objectMapper.readValue(body, Response.class);

            PingResult.PingResultBuilder b = PingResult.builder().online(r.isOnline());
            if (r.getPlayers() != null) {
                b.playersOnline(r.getPlayers().getOnline());
                b.playersMax(r.getPlayers().getMax());
            }
            if (r.getVersion() != null) b.version(r.getVersion().getNameClean());
            if (r.getMotd() != null) b.motd(r.getMotd().getClean());
            return b.build();
        } catch (Exception e) {
            log.warn("mcstatus.io ping failed for {}: {}", address, e.getMessage());
            return PingResult.offline();
        }
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Response {
        private boolean online;
        private Players players;
        private Version version;
        private Motd motd;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Players {
        private int online;
        private int max;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Version {
        private String name_clean;

        public String getNameClean() { return name_clean; }
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Motd {
        private String clean;
    }
}
