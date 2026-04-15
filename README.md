# TeleExam AI - Admin Web Portal

A high-performance, secure, and professional administrative command center for the **TeleExam AI** platform. Built with modern web technologies, this portal provides deep insights and granular control over the platform's ecosystem.

---

## ✨ Features

- **🔐 Secure Authentication**: JWT-based OAuth2 flow with automatic token refreshing and secure storage.
- **🛡️ Granular RBAC**: Multi-tier permission system (Superadmin vs. Standard Moderator).
- **📊 Real-time Analytics**: Interactive data visualization of User Growth, DAU, and Exam performance.
- **🚫 Automated Moderation**: Instant Ban/Unban capabilities with investigation audit logs.
- **🔑 Admin Orchestration**: Invite and manage moderators with specific permission scopes.
- **🌓 Dynamic UI**: Premium responsive interface with optimized light/dark modes.

---

## 🛠 Tech Stack

- **Core**: React 18 + Vite
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **State & Data**: React Hook Form + Zod + Axios
- **Routing**: React Router DOM (v6)

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have **Node.js 18+** installed on your system.

### 2. Installation
```bash
git clone https://github.com/yourusername/teleexam-admin.git
cd teleexam-admin
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
VITE_API_BASE_URL=http://your-api-server.com
```

### 4. Launch Development
```bash
npm run dev
```
Open [http://localhost:8080](http://localhost:8080) to access the portal.

---

## 📁 Project Architecture

```text
src/
├── components/        # Specialized & UI components (shadcn)
├── contexts/          # Auth & Global State providers
├── hooks/             # Custom React hooks (debounce, etc.)
├── lib/               # API clients & Auth utilities (JWT decoding)
├── pages/             # Main route views (Dashboard, Users, Admins)
└── App.tsx            # Routing & Layout orchestration
```

---

## 🛡️ Security Compliance

1. **Purged Logs**: All diagnostic `console.log` statements are stripped for production.
2. **Standard Interceptors**: Axios interceptors handle 401/403 states with automatic redirect security.
3. **Frontend Guarding**: Components and routes are guarded by a custom `Permission` provider.
4. **No Side-Effects**: The portal maintains zero telemetry/tracking for maximum privacy.

---

## 📄 License

Proprietary License - Part of the TeleExam AI Ecosystem.
All Rights Reserved.

---

Built for TeleExam AI Operations.
