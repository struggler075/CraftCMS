package com.craftcms.repository;

import com.craftcms.model.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    // ── Public shop — must respect both active=true and deleted=false ─────────

    @Query("SELECT p FROM Product p WHERE p.active = true AND p.deleted = false AND p.category.slug = :slug")
    Page<Product> findByActiveTrueAndCategorySlug(@Param("slug") String slug, Pageable pageable);

    @Query("SELECT p FROM Product p WHERE p.active = true AND p.deleted = false")
    Page<Product> findByActiveTrue(Pageable pageable);

    @Query("SELECT p FROM Product p WHERE p.active = true AND p.deleted = false AND p.featured = true")
    List<Product> findByActiveTrueAndFeaturedTrue();

    @Query("SELECT COUNT(p) FROM Product p WHERE p.active = true AND p.deleted = false")
    long countByActiveTrue();

    /**
     * Per-server listing — products of this server plus globals (server IS NULL).
     */
    @Query("""
            SELECT p FROM Product p
            WHERE p.active = true AND p.deleted = false
              AND (p.server.id = :serverId OR p.server IS NULL)
            """)
    Page<Product> findActiveForServer(@Param("serverId") Long serverId, Pageable pageable);

    @Query("""
            SELECT p FROM Product p
            WHERE p.active = true AND p.deleted = false
              AND (p.server.id = :serverId OR p.server IS NULL)
              AND p.category.slug = :categorySlug
            """)
    Page<Product> findActiveForServerAndCategory(
            @Param("serverId") Long serverId,
            @Param("categorySlug") String categorySlug,
            Pageable pageable);

    // ── Admin list — hide soft-deleted rows but keep the inactive ones visible
    //     (admin still needs to see hidden products to re-enable them) ────────

    List<Product> findByDeletedFalse(Sort sort);
}
