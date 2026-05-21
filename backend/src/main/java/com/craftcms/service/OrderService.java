package com.craftcms.service;

import com.craftcms.dto.OrderDto;
import com.craftcms.dto.PurchaseRequest;
import com.craftcms.model.Order;
import com.craftcms.model.Product;
import com.craftcms.model.User;
import com.craftcms.repository.OrderRepository;
import com.craftcms.repository.ProductRepository;
import com.craftcms.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    @Transactional
    public OrderDto purchase(String username, PurchaseRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new NoSuchElementException("Product not found"));

        if (!product.getActive()) {
            throw new IllegalStateException("Товар недоступен");
        }

        boolean trackStock = !Boolean.TRUE.equals(product.getQuantityEnabled());
        if (trackStock && product.getStock() < request.getQuantity()) {
            throw new IllegalStateException("Недостаточно товара на складе");
        }

        BigDecimal total = product.getPrice().multiply(BigDecimal.valueOf(request.getQuantity()));
        if (user.getBalance().compareTo(total) < 0) {
            BigDecimal diff = total.subtract(user.getBalance());
            throw new IllegalStateException("Недостаточно средств. Не хватает " + diff + " ₽");
        }

        user.setBalance(user.getBalance().subtract(total));
        if (trackStock) {
            product.setStock(product.getStock() - request.getQuantity());
        }

        userRepository.save(user);
        productRepository.save(product);

        Order order = orderRepository.save(Order.builder()
                .user(user)
                .product(product)
                .quantity(request.getQuantity())
                .totalPrice(total)
                .build());

        return toDto(order);
    }

    public List<OrderDto> getUserOrders(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    private OrderDto toDto(Order order) {
        Product product = order.getProduct();
        // Defensive null-checks — historical orders may reference a product
        // that was later soft-deleted or had its category/server detached.
        var server   = product != null ? product.getServer()   : null;
        var category = product != null ? product.getCategory() : null;
        return OrderDto.builder()
                .id(order.getId())
                .productName(product != null ? product.getName() : "(удалён)")
                .productImageUrl(product != null ? product.getImageUrl() : null)
                .categoryName(category != null ? category.getName() : null)
                .quantity(order.getQuantity())
                .totalPrice(order.getTotalPrice())
                .status(order.getStatus())
                .createdAt(order.getCreatedAt())
                .serverId(server != null ? server.getId() : null)
                .serverName(server != null ? server.getName() : null)
                .build();
    }
}
