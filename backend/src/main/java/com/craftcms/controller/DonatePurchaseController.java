package com.craftcms.controller;

import com.craftcms.model.DonateOrder;
import com.craftcms.repository.DonateOrderRepository;
import com.craftcms.repository.DonateRankRepository;
import com.craftcms.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/user/donate")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
public class DonatePurchaseController {

    private final DonateRankRepository rankRepo;
    private final UserRepository userRepo;
    private final DonateOrderRepository donateOrderRepo;

    @PostMapping("/buy/{rankId}")
    @Transactional
    public ResponseEntity<?> buy(@PathVariable Long rankId,
                                  @AuthenticationPrincipal UserDetails principal) {
        var rank = rankRepo.findById(rankId).orElse(null);
        if (rank == null) return ResponseEntity.notFound().build();

        var user = userRepo.findByUsername(principal.getUsername()).orElseThrow();

        BigDecimal price = BigDecimal.valueOf(rank.getPrice());
        if (user.getBalance().compareTo(price) < 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Недостаточно средств"));
        }

        user.setBalance(user.getBalance().subtract(price));
        userRepo.save(user);

        donateOrderRepo.save(DonateOrder.builder().user(user).rank(rank).build());

        return ResponseEntity.ok(Map.of("newBalance", user.getBalance()));
    }
}
