package com.craftcms.client;

import com.craftcms.dto.ServerStatusResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "mc-server-status", url = "https://api.mcsrvstat.us")
public interface McServerStatusClient {

    @GetMapping("/3/{address}")
    ServerStatusResponse getServerStatus(@PathVariable("address") String address);
}
