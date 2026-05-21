package com.craftcms.repository;

import com.craftcms.model.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    Page<Product> findByActiveTrueAndCategorySlug(String categorySlug, Pageable pageable);
    Page<Product> findByActiveTrue(Pageable pageable);
    List<Product> findByActiveTrueAndFeaturedTrue();
    long countByActiveTrue();

    // Per-server queries — used by the new shop landing.
    Page<Product> findByActiveTrueAndServerId(Long serverId, Pageable pageable);
    Page<Product> findByActiveTrueAndServerIdAndCategorySlug(Long serverId, String categorySlug, Pageable pageable);
}
