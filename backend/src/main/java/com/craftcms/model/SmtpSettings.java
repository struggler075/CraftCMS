package com.craftcms.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "smtp_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SmtpSettings {

    @Id
    @Builder.Default
    private Long id = 1L;

    @Builder.Default
    private boolean enabled = false;

    private String host;

    @Builder.Default
    private Integer port = 587;

    private String username;

    private String password;

    private String fromEmail;

    @Builder.Default
    private String fromName = "CraftCMS";

    @Builder.Default
    private boolean ssl = false;
}
