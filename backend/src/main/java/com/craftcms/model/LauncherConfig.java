package com.craftcms.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "launcher_configs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LauncherConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String version;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String windowsUrl;
    private String linuxUrl;
    private String macUrl;

    @Builder.Default
    private boolean active = true;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @PreUpdate
    private void onUpdate() { }
}
