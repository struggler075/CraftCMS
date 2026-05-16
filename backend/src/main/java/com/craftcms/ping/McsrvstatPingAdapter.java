package com.craftcms.ping;

import com.craftcms.client.McServerStatusClient;
import com.craftcms.dto.PingResult;
import com.craftcms.dto.ServerStatusResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class McsrvstatPingAdapter implements ServerPingAdapter {

    private final McServerStatusClient client;

    @Override
    public PingResult ping(String address) {
        try {
            ServerStatusResponse r = client.getServerStatus(address);
            PingResult.PingResultBuilder b = PingResult.builder().online(r.isOnline());
            if (r.getPlayers() != null) {
                b.playersOnline(r.getPlayers().getOnline());
                b.playersMax(r.getPlayers().getMax());
            }
            b.version(r.getVersion());
            if (r.getMotd() != null && r.getMotd().getClean() != null && r.getMotd().getClean().length > 0) {
                b.motd(r.getMotd().getClean()[0]);
            }
            return b.build();
        } catch (Exception e) {
            log.warn("mcsrvstat ping failed for {}: {}", address, e.getMessage());
            return PingResult.offline();
        }
    }
}
