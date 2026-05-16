package com.craftcms.ping;

import com.craftcms.dto.PingResult;

public interface ServerPingAdapter {
    PingResult ping(String address);
}
