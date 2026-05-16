# CraftCMS — Minecraft Universe

Production-grade Minecraft CMS with shop, news, server monitoring, and admin panel.

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Spring Boot 3.2 + Spring Security (JWT) + Spring Cloud OpenFeign + JPA/H2 |
| Frontend | React 18 + TypeScript + Tailwind CSS + Framer Motion |
| Auth | JWT (JJWT 0.12.3), BCrypt |
| Server monitoring | mcsrvstat.us API via OpenFeign |

## Quick Start

### Backend

```bash
cd backend
./mvnw spring-boot:run
# Runs on http://localhost:8080
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

## Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `Admin123!` |
| User | `steve` | `Steve123!` |

## Project Structure

```
CMSMinecraft/
├── backend/                  # Spring Boot API
│   └── src/main/java/com/craftcms/
│       ├── config/           # Security, CORS, DataInitializer
│       ├── controller/       # REST controllers
│       ├── service/          # Business logic
│       ├── model/            # JPA entities
│       ├── repository/       # Spring Data repos
│       ├── dto/              # Data transfer objects
│       ├── security/         # JWT filter & provider
│       └── client/           # OpenFeign (mcsrvstat.us)
└── frontend/                 # React SPA
    └── src/
        ├── components/
        │   ├── layout/       # Navbar, Footer, PageTransition
        │   ├── ui/           # GlassCard, NeonButton, NeonBadge
        │   ├── home/         # Hero, News, Servers sections
        │   └── shop/         # ProductCard, CategorySidebar, Cart
        ├── pages/            # HomePage, ShopPage, LoginPage, RegisterPage
        ├── pages/admin/      # AdminLayout, Dashboard, Products, etc.
        ├── store/            # Zustand (auth + cart)
        ├── services/         # Axios API client
        └── types/            # TypeScript interfaces
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | - | Register |
| POST | `/api/auth/login` | - | Login → JWT |
| GET | `/api/categories` | - | All categories |
| GET | `/api/products` | - | Products (paginated, filterable) |
| GET | `/api/servers` | - | Servers with live status |
| GET | `/api/news` | - | News (paginated) |
| GET/POST/PUT/DELETE | `/api/admin/**` | ADMIN | Full CRUD |

## Design System

- **Style**: Retro-Futurism / Dark Glassmorphism
- **Primary**: `#7C3AED` (purple)
- **Green**: `#22c55e` (Minecraft grass)
- **Gold**: `#f59e0b` (items/ranks)
- **Background**: `#0F0F23`
- **Fonts**: Russo One (headings) + Chakra Petch (body)
- **Animations**: Framer Motion page transitions + spring animations
