package com.craftcms.service;

import com.craftcms.dto.ProductDto;
import com.craftcms.model.Category;
import com.craftcms.model.MinecraftServer;
import com.craftcms.model.Product;
import com.craftcms.repository.CategoryRepository;
import com.craftcms.repository.MinecraftServerRepository;
import com.craftcms.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final MinecraftServerRepository serverRepository;

    public Page<Product> getProducts(String categorySlug, Long serverId, Pageable pageable) {
        boolean hasCategory = categorySlug != null && !categorySlug.isBlank();
        // When a server is picked we want: products of this server PLUS global
        // (server=NULL) products — common items like currency should appear
        // in every server's shop without manual duplication.
        if (serverId != null && hasCategory) {
            return productRepository.findActiveForServerAndCategory(serverId, categorySlug, pageable);
        }
        if (serverId != null) {
            return productRepository.findActiveForServer(serverId, pageable);
        }
        if (hasCategory) {
            return productRepository.findByActiveTrueAndCategorySlug(categorySlug, pageable);
        }
        return productRepository.findByActiveTrue(pageable);
    }

    public Product getById(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Product not found: " + id));
    }

    public List<Product> getFeatured() {
        return productRepository.findByActiveTrueAndFeaturedTrue();
    }

    @Transactional
    public Product create(ProductDto dto) {
        Category category = categoryRepository.findById(dto.getCategoryId())
                .orElseThrow(() -> new NoSuchElementException("Category not found"));

        Product product = Product.builder()
                .name(dto.getName())
                .description(dto.getDescription())
                .price(dto.getPrice())
                .imageUrl(dto.getImageUrl())
                .category(category)
                .server(resolveServer(dto.getServerId()))
                .stock(dto.getStock() != null ? dto.getStock() : 0)
                .featured(dto.getFeatured() != null ? dto.getFeatured() : false)
                .active(dto.getActive() != null ? dto.getActive() : true)
                .type(dto.getType())
                .command(dto.getCommand())
                .quantityEnabled(dto.getQuantityEnabled() != null ? dto.getQuantityEnabled() : false)
                .defaultQuantity(dto.getDefaultQuantity() != null ? dto.getDefaultQuantity() : 1)
                .build();

        return productRepository.save(product);
    }

    @Transactional
    public Product update(Long id, ProductDto dto) {
        Product product = getById(id);
        Category category = categoryRepository.findById(dto.getCategoryId())
                .orElseThrow(() -> new NoSuchElementException("Category not found"));

        product.setName(dto.getName());
        product.setDescription(dto.getDescription());
        product.setPrice(dto.getPrice());
        product.setImageUrl(dto.getImageUrl());
        product.setCategory(category);
        product.setServer(resolveServer(dto.getServerId()));
        if (dto.getStock() != null) product.setStock(dto.getStock());
        if (dto.getFeatured() != null) product.setFeatured(dto.getFeatured());
        if (dto.getActive() != null) product.setActive(dto.getActive());
        if (dto.getType() != null) product.setType(dto.getType());
        if (dto.getCommand() != null) product.setCommand(dto.getCommand());
        if (dto.getQuantityEnabled() != null) product.setQuantityEnabled(dto.getQuantityEnabled());
        if (dto.getDefaultQuantity() != null) product.setDefaultQuantity(dto.getDefaultQuantity());

        return productRepository.save(product);
    }

    /** Resolves serverId to MinecraftServer. Null → null (no server). Invalid id → null (don't crash). */
    private MinecraftServer resolveServer(Long serverId) {
        if (serverId == null) return null;
        return serverRepository.findById(serverId).orElse(null);
    }

    @Transactional
    public void delete(Long id) {
        Product product = getById(id);
        product.setActive(false);
        productRepository.save(product);
    }
}
