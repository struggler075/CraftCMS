package com.craftcms.repository;

import com.craftcms.model.DonateFeature;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DonateFeatureRepository extends JpaRepository<DonateFeature, Long> {
    List<DonateFeature> findAllByOrderBySortOrderAsc();
}
