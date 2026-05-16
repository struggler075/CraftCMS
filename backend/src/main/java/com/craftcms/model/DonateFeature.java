package com.craftcms.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "donate_features")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DonateFeature {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Builder.Default
    private int sortOrder = 0;
}
