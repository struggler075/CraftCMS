package com.craftcms.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "donate_ranks")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DonateRank {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Builder.Default
    private String color = "#7c3aed";

    private String imageUrl;

    @Builder.Default
    private int price = 0;

    private String buyLink;

    @Builder.Default
    private int sortOrder = 0;

    @Builder.Default
    private boolean featured = false;

    @Column(columnDefinition = "TEXT")
    private String command;

    // JSON array of DonateFeature IDs that this rank includes: [1,2,3]
    @Builder.Default
    @Column(columnDefinition = "TEXT")
    private String featureIdsJson = "[]";
}
