package com.craftcms.config;

import com.craftcms.model.*;
import com.craftcms.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final MinecraftServerRepository serverRepository;
    private final NewsRepository newsRepository;
    private final LauncherConfigRepository launcherConfigRepository;
    private final DonateRankRepository donateRankRepository;
    private final DonateFeatureRepository donateFeatureRepository;
    private final SiteSettingsRepository siteSettingsRepository;
    private final SmtpSettingsRepository smtpSettingsRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        // Singleton row id=1. existsById (not count==0) so a stray row at id!=1
        // can never block seeding — and re-seeding is impossible once id=1 exists.
        if (!siteSettingsRepository.existsById(1L)) {
            log.info("Seeding SiteSettings singleton row (id=1) with defaults.");
            siteSettingsRepository.save(SiteSettings.builder()
                    .id(1L)
                    .bridgeApiKey(UUID.randomUUID().toString())
                    .build());
        }
        if (smtpSettingsRepository.count() == 0) {
            smtpSettingsRepository.save(SmtpSettings.builder().build());
        }
        if (userRepository.count() == 0) {
            log.info("Seeding database with initial data...");
            seedUsers();
            List<Category> cats = seedCategories();
            seedProducts(cats);
            seedServers();
            seedNews();
            seedLauncher();
            log.info("Database seeded successfully.");
        }

        if (donateRankRepository.count() == 0) {
            log.info("Seeding donate data...");
            seedDonate();
        }
    }

    private void seedUsers() {

        userRepository.save(User.builder()
                .username("admin")
                .email("admin@craftcms.ru")
                .password(passwordEncoder.encode("Admin123!"))
                .role(Role.ADMIN)
                .emailVerified(true)
                .build());

        userRepository.save(User.builder()
                .username("steve")
                .email("steve@craftcms.ru")
                .password(passwordEncoder.encode("Steve123!"))
                .role(Role.USER)
                .emailVerified(true)
                .build());
    }

    private List<Category> seedCategories() {
        Category blocks = categoryRepository.save(Category.builder()
                .name("Блоки").slug("blocks").icon("cube").description("Строительные блоки").sortOrder(1).build());
        Category items = categoryRepository.save(Category.builder()
                .name("Предметы").slug("items").icon("package").description("Игровые предметы").sortOrder(2).build());
        Category armor = categoryRepository.save(Category.builder()
                .name("Броня").slug("armor").icon("shield").description("Защитное снаряжение").sortOrder(3).build());
        Category weapons = categoryRepository.save(Category.builder()
                .name("Оружие").slug("weapons").icon("sword").description("Мечи и луки").sortOrder(4).build());
        Category ranks = categoryRepository.save(Category.builder()
                .name("Ранги").slug("ranks").icon("crown").description("Привилегии на сервере").sortOrder(5).build());
        Category kits = categoryRepository.save(Category.builder()
                .name("Киты").slug("kits").icon("gift").description("Готовые наборы").sortOrder(6).build());

        return List.of(blocks, items, armor, weapons, ranks, kits);
    }

    private void seedProducts(List<Category> cats) {
        Category blocks = cats.get(0);
        Category items = cats.get(1);
        Category armor = cats.get(2);
        Category weapons = cats.get(3);
        Category ranks = cats.get(4);
        Category kits = cats.get(5);

        productRepository.saveAll(List.of(
            product("Алмазный блок", "блока алмаза высшего качества", "149.00", blocks, ProductType.BLOCK, true),
            product("Изумрудный блок", "блока изумруда", "89.00", blocks, ProductType.BLOCK, false),
            product("Блок неврита", "блоков неврита — редчайший материал", "299.00", blocks, ProductType.BLOCK, true),
            product("Золотой блок", "золотых блока", "79.00", blocks, ProductType.BLOCK, false),
            product("Эликсир скорости III", "Зелье скорости 3 уровня", "59.00", items, ProductType.ITEM, false),
            product("Эликсир силы II", "Зелье силы 2 уровня (8 мин)", "79.00", items, ProductType.ITEM, true),
            product("Тотем бессмертия", "Защита от смерти одного игрока", "399.00", items, ProductType.ITEM, true),
            product("Алмазная броня (полный сет)", "Полный комплект алмазной брони", "399.00", armor, ProductType.ARMOR, true),
            product("Непритовая броня (полный сет)", "Лучшая броня в игре", "899.00", armor, ProductType.ARMOR, true),
            product("Алмазный меч (Острота V)", "Алмазный меч с максимальной остротой", "249.00", weapons, ProductType.WEAPON, false),
            product("Непритовый меч (Острота V)", "Непритовый меч — оружие легенды", "599.00", weapons, ProductType.WEAPON, true),
            product("Лук (Бесконечность I)", "Лук с зачарованием бесконечности", "199.00", weapons, ProductType.WEAPON, false),
            product("VIP Ранг (30 дней)", "Доступ к VIP зонам, x2 опыт, цветной ник", "199.00", ranks, ProductType.RANK, false),
            product("Premium Ранг (30 дней)", "Все привилегии VIP + полёт в мирном режиме", "399.00", ranks, ProductType.RANK, true),
            product("Elite Ранг (навсегда)", "Постоянный Elite статус, все привилегии", "1499.00", ranks, ProductType.RANK, true),
            product("Стартовый кит", "Алмазная броня, меч, еда на старт", "299.00", kits, ProductType.KIT, false),
            product("PvP Мастер кит", "Лучшее PvP снаряжение и зелья", "599.00", kits, ProductType.KIT, true),
            product("Строитель Про кит", "стаков блоков для строительства", "249.00", kits, ProductType.KIT, false)
        ));
    }

    private Product product(String name, String desc, String price, Category cat, ProductType type, boolean featured) {
        return Product.builder()
                .name(name)
                .description(desc)
                .price(new BigDecimal(price))
                .category(cat)
                .quantityEnabled(true)
                .defaultQuantity(1)
                .type(type)
                .featured(featured)
                .stock(999)
                .active(true)
                .imageUrl("https://placehold.co/400x400/1a1a3e/A78BFA?text=" +
                        name.substring(0, Math.min(name.length(), 8)).replace(" ", "+"))
                .build();
    }

    private void seedServers() {
        serverRepository.saveAll(List.of(
            MinecraftServer.builder()
                .name("CraftCMS Survival").address("mc.hypixel.net")
                .description("Классическое выживание с экономикой и кланами")
                .featured(true).sortOrder(1).active(true).build(),
            MinecraftServer.builder()
                .name("CraftCMS SkyBlock").address("play.mineplex.com")
                .description("Классический SkyBlock с уникальными островами")
                .featured(true).sortOrder(2).active(true).build(),
            MinecraftServer.builder()
                .name("CraftCMS Creative").address("2b2t.org")
                .description("Неограниченное творческое строительство")
                .featured(false).sortOrder(3).active(true).build()
        ));
    }

    private void seedNews() {
        newsRepository.saveAll(List.of(
            buildNews("Обновление сервера 2.5!",
                "Встречайте масштабное обновление с новыми биомами, мобами и механиками. Мы полностью переработали систему крафта.",
                "Встречайте масштабное обновление 2.5!", "UPDATE", LocalDateTime.now().minusDays(1)),
            buildNews("Летнее событие 2026",
                "В этом лете мы запускаем грандиозное событие с эксклюзивными наградами и скидками до 50%.",
                "Летнее событие уже здесь!", "EVENT", LocalDateTime.now().minusDays(3)),
            buildNews("Топ PvP игроков мая",
                "Подводим итоги PvP турнира за май. Победители получили эксклюзивные ранги и кристаллы.",
                "Результаты PvP турнира за май", "NEWS", LocalDateTime.now().minusDays(7)),
            buildNews("Новый режим: Фракции",
                "Мы запускаем долгожданный режим Фракций! Создайте свой клан и захватывайте территории.",
                "Режим Фракций открыт!", "ANNOUNCEMENT", LocalDateTime.now().minusDays(10)),
            buildNews("Технические работы 18 мая",
                "18 мая с 03:00 до 05:00 МСК проводятся плановые технические работы.",
                "Технические работы 18 мая", "NEWS", LocalDateTime.now().minusDays(14)),
            buildNews("Скидки на ранги -30%",
                "Только до конца месяца скидка 30% на все ранги в магазине.",
                "Скидки 30% на ранги!", "EVENT", LocalDateTime.now().minusDays(2))
        ));
    }

    private void seedLauncher() {
        launcherConfigRepository.save(LauncherConfig.builder()
                .version("1.0.0")
                .description("Установите лаунчер для быстрого доступа к нашему модовому серверу. Автоматическая установка модов и обновлений.")
                .windowsUrl("https://example.com/launcher/craftcms-launcher-1.0.0-win.exe")
                .linuxUrl("https://example.com/launcher/craftcms-launcher-1.0.0-linux.tar.gz")
                .macUrl("https://example.com/launcher/craftcms-launcher-1.0.0-mac.dmg")
                .active(true)
                .build());
    }

    private void seedDonate() {
        // ── Привилегии ────────────────────────────────────────────────────────
        DonateFeature f1  = feat("Вход на заполненный сервер", 1);
        DonateFeature f2  = feat("Цветные сообщения в чат", 2);
        DonateFeature f3  = feat("Цветные сообщения на табличках", 3);
        DonateFeature f4  = feat("Кастомный префикс в чате", 4);
        DonateFeature f5  = feat("Команда /fly в лобби", 5);
        DonateFeature f6  = feat("Команда /nick (смена ника)", 6);
        DonateFeature f7  = feat("Увеличенный размер инвентаря", 7);
        DonateFeature f8  = feat("Доступ к VIP-зонам и территориям", 8);
        DonateFeature f9  = feat("Приоритет в очереди на вход", 9);
        DonateFeature f10 = feat("Ежедневный эксклюзивный кит", 10);

        // ── Ранги ─────────────────────────────────────────────────────────────
        rank("Pro",     "#6366f1", 35,    1, false, f1);
        rank("Vip",     "#22c55e", 150,   2, false, f1, f2, f9);
        rank("Premium", "#3b82f6", 200,   3, false, f1, f2, f3, f9);
        rank("Elite",   "#f59e0b", 400,   4, true,  f1, f2, f3, f4, f5, f9);
        rank("Deluxe",  "#f97316", 750,   5, false, f1, f2, f3, f4, f5, f6, f9);
        rank("Mod",     "#8b5cf6", 1400,  6, false, f1, f2, f3, f4, f5, f6, f7, f8, f9);
        rank("TrueMod", "#ef4444", 2000,  7, false, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10);
        rank("Sponsor", "#dc2626", 40000, 8, false, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10);
    }

    private DonateFeature feat(String name, int order) {
        return donateFeatureRepository.save(DonateFeature.builder().name(name).sortOrder(order).build());
    }

    private void rank(String name, String color, int price, int order, boolean featured, DonateFeature... features) {
        String ids = "[" + Arrays.stream(features)
                .map(f -> String.valueOf(f.getId()))
                .collect(Collectors.joining(",")) + "]";
        donateRankRepository.save(DonateRank.builder()
                .name(name).color(color).price(price).sortOrder(order)
                .featured(featured).featureIdsJson(ids).build());
    }

    private News buildNews(String title, String content, String excerpt, String cat, LocalDateTime date) {
        return News.builder()
                .title(title)
                .content(content)
                .excerpt(excerpt)
                .author("CraftCMS Team")
                .category(NewsCategory.valueOf(cat))
                .published(true)
                .createdAt(date)
                .imageUrl("https://placehold.co/800x400/1a1a3e/7C3AED?text=" +
                        title.substring(0, Math.min(title.length(), 12)).replace(" ", "+"))
                .build();
    }
}
