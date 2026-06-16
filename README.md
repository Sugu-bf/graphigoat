# 🐐 GraphiGOAT Static Site

[![Docker Image](https://img.shields.io/badge/Docker-Enabled-blue.svg?logo=docker&logoColor=white)](./Dockerfile)
[![Nginx](https://img.shields.io/badge/Nginx-Served-green.svg?logo=nginx&logoColor=white)](https://nginx.org)
[![Platform](https://img.shields.io/badge/Platform-Static--HTML-orange.svg)](https://developer.mozilla.org/en-US/docs/Web/HTML)

Welcome to the official repository for **GraphiGOAT**. This is a high-performance static website designed to be served directly from any standard web server or containerized using Docker.

---

## 📁 Repository Structure

```text
graphigoat/
├── assets/                     # Global static assets (logos, favicons, etc.)
├── clients/
│   └── magic-lite-workstreams/ # Client portal (private/unlinked tool)
│       ├── index.html          # Interactive client workstream dashboard
│       └── support.js          # App state logic (localStorage)
├── Dockerfile                  # Containerization instructions (Nginx-based)
├── .dockerignore               # Build context exclusions
├── index.html                  # Public homepage
└── README.md                   # You are here!
```

---

## 🌐 Pages & Access

| Page | URL Path | Visibility / SEO |
| :--- | :--- | :--- |
| **Public Homepage** | `/index.html` or `/` | Publicly indexed and searchable. |
| **Magic Lite Workstreams** | `/clients/magic-lite-workstreams/` | Private client page (`noindex, nofollow`). Unlinked from the homepage. |

> [!NOTE]  
> The **Magic Lite Workstreams** client page is fully static and client-side. Budget entries, workstream selections, and comments are saved securely within the **visitor's local browser storage (`localStorage`)**. No backend server is required to store this information.

---

## 🐳 Docker Deployment

The project is packaged with a lightweight Docker configuration using `nginx:alpine`.

### 1. Build the Docker Image
To build the image locally:
```bash
docker build -t graphigoat .
```

### 2. Run the Container
To run the container and map it to port `8080` on your host machine:
```bash
docker run -d -p 8080:80 --name graphigoat-app graphigoat
```
Once started, the website will be available at [http://localhost:8080](http://localhost:8080).

---

## 🚀 Cloud Deployment (e.g. Coolify, Vercel)

This repository is optimized for instant deployment:
- **Coolify / Docker-based Hosts**: Automatically detects the `Dockerfile` and exposes port `80`.
- **Static Hosting (Netlify, Vercel, GitHub Pages)**: Can be deployed directly by pointing the build output to the root directory `/` (no compilation step needed).

---

## 🛡️ Security & Privacy
- Access to the client directory `/clients/magic-lite-workstreams/` is obscured and unlinked, but remains publicly accessible via direct URL. If true access restriction is required, configure password protection (basic auth) at the server level (e.g., in Nginx or your hosting panel).
