package com.craftcms.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "payment_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentSettings {

    @Id
    @Builder.Default
    private Long id = 1L;

    // FreeKassa
    @Builder.Default private boolean freekassaEnabled = false;
    @Builder.Default private String freekassaMerchantId = "";
    @Builder.Default private String freekassaSecretKey1 = "";
    @Builder.Default private String freekassaSecretKey2 = "";

    // UnitPay
    @Builder.Default private boolean unitpayEnabled = false;
    @Builder.Default private String unitpayPublicKey = "";
    @Builder.Default private String unitpaySecretKey = "";

    // Stripe
    @Builder.Default private boolean stripeEnabled = false;
    @Builder.Default private String stripePublishableKey = "";
    @Builder.Default private String stripeSecretKey = "";
    @Builder.Default private String stripeWebhookSecret = "";

    // YooKassa
    @Builder.Default private boolean yookassaEnabled = false;
    @Builder.Default private String yookassaShopId = "";
    @Builder.Default private String yookassaSecretKey = "";

    // TradeMC
    @Builder.Default private boolean trademcEnabled = false;
    @Builder.Default private String trademcShopId = "";
    @Builder.Default private String trademcItemId = "";
    @Builder.Default private String trademcShopKey = "";

    @Builder.Default private boolean showLogosInFooter = true;

    // Which provider is used for balance top-ups (empty = none configured)
    @Builder.Default private String topUpProvider = "";
}
