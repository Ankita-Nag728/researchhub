# ResearchHub: Phase 1 Architecture Plan

## 1. Big picture

```
Browser (React + Vite SPA)
   |  HTTPS, JSON, HttpOnly session cookie + CSRF header
   v
FastAPI (routers -> services -> SQLAlchemy models)
   |  parameterized queries only
   v
PostgreSQL (migrations via Alembic)
```

- The frontend never talks to the database. It only calls `/api/*`.
- Every permission check happens in FastAPI dependencies, so hiding a button in React is only a convenience, never the protection.

## 2. Key technical decisions (please confirm or change)

| # | Decision | Why (plain language) |
|---|----------|----------------------|
| D1 | **Server-side sessions in the database**, with a random opaque token in an HttpOnly, Secure, SameSite cookie. Only a hash of the token is stored. | Logout truly invalidates the session, and JavaScript can never read the token (protects against XSS theft). Simpler to reason about than JWTs. |
| D2 | **CSRF protection via double-submit token**: a readable `csrf_token` cookie is echoed back in an `X-CSRF-Token` header on every POST/PUT/PATCH/DELETE. | Required because we use cookies. |
| D3 | **Argon2id** via `argon2-cffi` for password hashing. | Modern, recommended default. |
| D4 | **Rate limiting** with `slowapi` on login, register, forgot/reset password. | Stops brute force and reset abuse. |
| D5 | **Password reset**: single-use, hashed, 30-minute tokens. The response is identical whether or not the email exists. In development the reset link is printed to the server log. A real email provider is needed for production. | Prevents user enumeration. |
| D6 | **Admins are never created via the API.** A CLI command (`python -m app.cli create-admin`) prompts for email and password. | Meets the "no hardcoded admin password" rule. |
| D7 | **Deployment on the same site**: Vercel rewrites `/api/*` to the Render backend (or both live under one custom domain, e.g. `app.example.com` and `api.example.com`). | SameSite cookies do not work well across unrelated domains such as `*.vercel.app` and `*.onrender.com`. This is the most common deployment bug with this stack. |
| D8 | **Bookmarks** table follows your schema (`project_id`). Paper bookmarks need a second table `paper_bookmarks`, because the spec asks for both saved projects and saved papers. | The spec's schema only covers projects, but the papers page requires bookmarking. |
| D9 | **Archive** a project via `status = archived`, which is hidden from public lists. Hard delete is allowed only when there are no applications. | Protects applicants' history. |
| D10 | **Sanitization**: React escapes output by default and we never use `dangerouslySetInnerHTML`. The backend strips control characters, enforces length limits, and validates URLs as http(s) only. | Blocks stored and reflected XSS. |
| D11 | **Tests**: Pytest with a separate test database (backend), Vitest + React Testing Library (frontend). | Matches the spec. |
| D12 | **Fonts**: Playfair Display (headings), Inter (body), via the `@fontsource` npm packages, self-hosted. | No third-party font requests, better privacy and speed. |

## 3. Folder structure

```
researchhub/
├── README.md
├── ARCHITECTURE.md
├── .gitignore                 # ignores .env, node_modules, __pycache__
├── backend/
│   ├── .env.example           # placeholders only
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/versions/
│   └── app/
│       ├── main.py            # app factory, middleware, error handlers
│       ├── cli.py             # create-admin, seed-demo
│       ├── core/              # config, security (argon2, tokens), rate limit, logging
│       ├── database/          # engine, session, base
│       ├── models/            # user, project, paper, application, bookmark, session
│       ├── schemas/           # Pydantic request/response models
│       ├── dependencies/      # get_db, current_user, require_admin, csrf
│       ├── routers/           # auth, projects, papers, applications, users, bookmarks, admin
│       ├── services/          # business rules (apply rules, filtering, stats)
│       └── tests/
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── .env.example
    └── src/
        ├── components/        # Navbar, Footer, Sidebar, ProjectCard, ...
        ├── pages/             # Landing, Explore, ProjectDetails, Papers, auth, dashboards
        ├── layouts/           # PublicLayout, DashboardLayout, AdminLayout
        ├── hooks/
        ├── services/          # api client + one module per resource
        ├── context/           # AuthContext, ToastContext
        ├── assets/
        ├── styles/            # tokens.css (palette), base.css, components
        └── utils/
```

## 4. Database overview

Tables: `users`, `research_projects`, `research_papers`, `applications`, `bookmarks`, plus the additions `paper_bookmarks`, `sessions`, `password_reset_tokens`.

- Unique: `users.email` (stored lowercased), `research_projects.slug`, `applications(user_id, project_id)`, `bookmarks(user_id, project_id)`.
- Indexes: project `status`, `domain`, `application_deadline`; paper `publication_year`, `category`; application `user_id`, `status`.
- Foreign keys use `ON DELETE CASCADE` for sessions and bookmarks, and `RESTRICT` for applications to projects.

## 5. Access matrix (enforced in the backend)

| Area | Guest | Student | Admin |
|------|:-----:|:-------:|:-----:|
| Browse projects and papers | yes | yes | yes |
| Apply, bookmark, own profile, own applications | no | yes | yes |
| `/api/admin/*`, create/edit/delete content | no | no | yes |

Students can read only their own applications; requesting another user's returns 404.

## 6. Build phases

1. Planning and architecture (this document)
2. Frontend setup and design system (tokens, fonts, base components)
3. Landing and public pages
4. Backend setup and database connection
5. Authentication and authorization
6. Project CRUD
7. Paper library
8. Applications and tracking
9. Admin dashboard
10. Security hardening and tests
11. Responsive polish
12. Deployment and docs

After each phase I will explain what was built, show the tree, list run/test commands, and list known issues. I will not mark anything complete until it has been run and tested.

## 7. Design tokens (from your spec)

`--bg #FFF9F8`, `--bg-alt #FFF1F3`, `--pink #F8DCE3`, `--rose #D987A2`, `--rose-deep #B85F7F`, `--burgundy #743C53`, `--text #352B30`, `--text-muted #82737A`, `--card #FFFFFF`, `--border #F0DDE3`.

Contrast note: `#D987A2` on white is too low for body text (about 2.8:1), so I will use rose only for accents and use deep rose or burgundy for text and button fills to stay accessible.

## 8. Open questions

1. Do you have PostgreSQL available locally (or Docker)? I can include a `docker-compose.yml` for the database.
2. For password-reset emails in production, which provider would you like (Resend, SendGrid, SMTP)? Development will just log the link.
3. Is the "remember me" option acceptable as a longer session lifetime (30 days vs. 8 hours)?
4. Do you agree with D7 (same-site deployment) and D8 (extra `paper_bookmarks` table)?
