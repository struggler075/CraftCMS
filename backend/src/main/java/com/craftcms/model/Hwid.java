package com.craftcms.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * Hardware-id binding row consumed by GravitLauncher's HWID protection.
 *
 * <p>The table is created automatically by Hibernate's {@code ddl-auto: update}
 * so a fresh install needs no manual SQL migration. Column names match exactly
 * what Gravit's {@code AbstractSQLCoreProvider} expects (all lowercase, no
 * snake_case), which is why every field carries an explicit {@code @Column(name=…)}.
 *
 * <p>Spring Boot doesn't read or write this table itself — it exists so the
 * foreign key on {@link User#getHwidid()} has a valid target.
 */
@Entity
@Table(name = "hwids")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Hwid {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "publickey", unique = true)
    private byte[] publickey;

    @Column(name = "hwdiskid", columnDefinition = "varchar")
    private String hwdiskid;

    @Column(name = "baseboardserialnumber", columnDefinition = "varchar")
    private String baseboardserialnumber;

    @Column(name = "graphiccard", columnDefinition = "varchar")
    private String graphiccard;

    @Column(name = "displayid")
    private byte[] displayid;

    @Column(name = "bitness")
    private Integer bitness;

    @Column(name = "totalmemory")
    private Long totalmemory;

    @Column(name = "logicalprocessors")
    private Integer logicalprocessors;

    @Column(name = "physicalprocessors")
    private Integer physicalprocessors;

    @Column(name = "processormaxfreq")
    private Long processormaxfreq;

    @Column(name = "battery")
    private Boolean battery;

    @Column(name = "banned")
    private Boolean banned;
}
