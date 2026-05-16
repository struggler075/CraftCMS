package com.craftcms.repository;

import com.craftcms.model.DonateOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DonateOrderRepository extends JpaRepository<DonateOrder, Long> {
    List<DonateOrder> findByUserUsernameAndClaimedFalseOrderByCreatedAtAsc(String username);
    void deleteByUserId(Long userId);
}
