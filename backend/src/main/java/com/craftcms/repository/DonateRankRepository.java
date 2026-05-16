package com.craftcms.repository;

import com.craftcms.model.DonateRank;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DonateRankRepository extends JpaRepository<DonateRank, Long> {
    List<DonateRank> findAllByOrderBySortOrderAsc();
}
