package com.craftcms.repository;

import com.craftcms.model.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    Page<Product> findByActiveTrueAndCategorySlug(String categorySlug, Pageable pageable);
    Page<Product> findByActiveTrue(Pageable pageable);
    List<Product> findByActiveTrueAndFeaturedTrue();
    long countByActiveTrue();

    /**
     * Per-server listing — includes products explicitly tied to this server
     * AND globally-scoped products (server is NULL). Used by the public shop
     * landing once a player picks a server.
     */
    @Query("""
            SELECT p FROM Product p
            WHERE p.active = true
              AND (p.server.id = :serverId OR p.server IS NULL)
            """)
    Page<Product> findActiveForServer(@Param("serverId") Long serverId, Pageable pageable);

    @Query("""
            SELECT p FROM Product p
            WHERE p.active = true
              AND (p.server.id = :serverId OR p.server IS NULL)
              AND p.category.slug = :categorySlug
            """)
    Page<Product> findActiveForServerAndCategory(
            @Param("serverId") Long serverId,
            @Param("categorySlug") String categorySlug,
            Pageable pageable);
}
