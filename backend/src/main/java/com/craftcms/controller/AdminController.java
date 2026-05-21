package com.craftcms.controller;

import com.craftcms.dto.ProductDto;
import com.craftcms.model.*;
import com.craftcms.repository.ProductRepository;
import com.craftcms.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final ProductService productService;
    private final CategoryService categoryService;
    private final ServerService serverService;
    private final NewsService newsService;
    private final ProductRepository productRepository;

    // ── Products ──────────────────────────────────────────────────────────────
    @GetMapping("/products")
    public ResponseEntity<List<Product>> getAllProducts() {
        // Hide tombstones (deleted=true) — they only exist to keep order
        // history's foreign keys valid; the admin shouldn't see them at all.
        return ResponseEntity.ok(productRepository.findByDeletedFalse(
                org.springframework.data.domain.Sort.by(
                        org.springframework.data.domain.Sort.Direction.DESC, "createdAt")));
    }

    @PostMapping("/products")
    public ResponseEntity<Product> createProduct(@Valid @RequestBody ProductDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(productService.create(dto));
    }

    @PutMapping("/products/{id}")
    public ResponseEntity<Product> updateProduct(@PathVariable Long id, @Valid @RequestBody ProductDto dto) {
        return ResponseEntity.ok(productService.update(id, dto));
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
        productService.delete(id);
        return ResponseEntity.noContent().build();
    }

    // ── Categories ────────────────────────────────────────────────────────────
    @PostMapping("/categories")
    public ResponseEntity<Category> createCategory(@RequestBody Category category) {
        return ResponseEntity.status(HttpStatus.CREATED).body(categoryService.create(category));
    }

    @PutMapping("/categories/{id}")
    public ResponseEntity<Category> updateCategory(@PathVariable Long id, @RequestBody Category category) {
        return ResponseEntity.ok(categoryService.update(id, category));
    }

    @DeleteMapping("/categories/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id) {
        categoryService.delete(id);
        return ResponseEntity.noContent().build();
    }

    // ── Servers ───────────────────────────────────────────────────────────────
    @GetMapping("/servers")
    public ResponseEntity<List<MinecraftServer>> getAllServers() {
        return ResponseEntity.ok(serverService.getAll());
    }

    @PostMapping("/servers")
    public ResponseEntity<MinecraftServer> createServer(@RequestBody MinecraftServer server) {
        return ResponseEntity.status(HttpStatus.CREATED).body(serverService.create(server));
    }

    @PutMapping("/servers/{id}")
    public ResponseEntity<MinecraftServer> updateServer(@PathVariable Long id, @RequestBody MinecraftServer server) {
        return ResponseEntity.ok(serverService.update(id, server));
    }

    @DeleteMapping("/servers/{id}")
    public ResponseEntity<Void> deleteServer(@PathVariable Long id) {
        serverService.delete(id);
        return ResponseEntity.noContent().build();
    }

    // ── News ──────────────────────────────────────────────────────────────────
    @PostMapping("/news")
    public ResponseEntity<News> createNews(@RequestBody News news) {
        return ResponseEntity.status(HttpStatus.CREATED).body(newsService.create(news));
    }

    @PutMapping("/news/{id}")
    public ResponseEntity<News> updateNews(@PathVariable Long id, @RequestBody News news) {
        return ResponseEntity.ok(newsService.update(id, news));
    }

    @DeleteMapping("/news/{id}")
    public ResponseEntity<Void> deleteNews(@PathVariable Long id) {
        newsService.delete(id);
        return ResponseEntity.noContent().build();
    }

    // ── Dashboard stats ───────────────────────────────────────────────────────
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(Map.of(
                "totalProducts", productRepository.countByActiveTrue(),
                "totalCategories", categoryService.getAll().size(),
                "totalServers", serverService.getAll().size(),
                "totalNews", newsService.getPublished(org.springframework.data.domain.PageRequest.of(0, 1)).getTotalElements()
        ));
    }
}
