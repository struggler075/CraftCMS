package com.craftcms.repository;

import com.craftcms.model.TopUpOrder;
import com.craftcms.model.TopUpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TopUpOrderRepository extends JpaRepository<TopUpOrder, String> {
    List<TopUpOrder> findByUserIdOrderByCreatedAtDesc(Long userId);
    Page<TopUpOrder> findAllByOrderByCreatedAtDesc(Pageable pageable);
    long countByStatus(TopUpStatus status);
}
