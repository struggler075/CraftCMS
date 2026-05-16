package com.craftcms.controller;

import com.craftcms.dto.BalanceRequest;
import com.craftcms.dto.OrderDto;
import com.craftcms.dto.PurchaseRequest;
import com.craftcms.dto.UserProfileDto;
import com.craftcms.model.User;
import com.craftcms.repository.OrderRepository;
import com.craftcms.repository.UserRepository;
import com.craftcms.service.AuthService;
import com.craftcms.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final OrderService orderService;
    private final AuthService authService;

    @GetMapping("/profile")
    public ResponseEntity<UserProfileDto> getProfile(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        return ResponseEntity.ok(UserProfileDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .role(user.getRole().name())
                .balance(user.getBalance())
                .createdAt(user.getCreatedAt())
                .totalOrders(orderRepository.countByUserId(user.getId()))
                .skinUrl(user.getSkinUrl())
                .capeUrl(user.getCapeUrl())
                .emailVerified(user.isEmailVerified())
                .build());
    }

    @PostMapping("/purchase")
    public ResponseEntity<OrderDto> purchase(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody PurchaseRequest request) {
        return ResponseEntity.ok(orderService.purchase(userDetails.getUsername(), request));
    }

    @GetMapping("/orders")
    public ResponseEntity<List<OrderDto>> getOrders(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(orderService.getUserOrders(userDetails.getUsername()));
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<Map<String, String>> resendVerification(@AuthenticationPrincipal UserDetails userDetails) {
        authService.resendVerification(userDetails.getUsername());
        return ResponseEntity.ok(Map.of("message", "Письмо отправлено"));
    }

    // Admin: add balance to user
    @PostMapping("/balance")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> addBalance(@Valid @RequestBody BalanceRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + request.getUsername()));

        user.setBalance(user.getBalance().add(request.getAmount()));
        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "message", "Balance updated",
                "username", user.getUsername(),
                "newBalance", user.getBalance()
        ));
    }
}
