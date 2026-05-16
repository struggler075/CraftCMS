package com.craftcms.ping;

import com.craftcms.dto.PingResult;
import com.craftcms.model.MinecraftServer;
import com.craftcms.model.PingMethod;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ServerPingService {

    private final McsrvstatPingAdapter mcsrvstat;
    private final McstatusPingAdapter mcstatus;
    private final DirectPingAdapter direct;

    public PingResult ping(MinecraftServer server) {
        PingMethod method = server.getPingMethod() != null ? server.getPingMethod() : PingMethod.MCSRVSTAT;
        return switch (method) {
            case MCSTATUS -> mcstatus.ping(server.getAddress());
            case DIRECT   -> direct.ping(server.getAddress());
            default        -> mcsrvstat.ping(server.getAddress());
        };
    }
}
