package com.craftcms.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "minecraft_servers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MinecraftServer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String address;

    private String description;

    private String imageUrl;

    @Builder.Default
    private Boolean featured = false;

    @Builder.Default
    private Boolean active = true;

    @Builder.Default
    private Integer sortOrder = 0;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private PingMethod pingMethod = PingMethod.MCSRVSTAT;

    /**
     * Per-server Bridge plugin API key. Patched into the JAR when an admin
     * downloads the plugin for THIS server. The Minecraft side then identifies
     * itself by this key on every callback, so the backend knows which server
     * the request is from and which orders to route to which world.
     */
    @Column(length = 128)
    private String bridgeApiKey;

    @OneToMany(mappedBy = "server", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @Builder.Default
    private List<ServerMod> mods = new ArrayList<>();
}
