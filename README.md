# TeleExam AI - Admin Web Panel

A modern, secure, and role-based admin dashboard for **TeleExam AI** — the AI-powered Telegram exam platform.

This web panel allows Superadmins and Admins to manage users, monitor analytics, invite moderators, and moderate content through a clean and intuitive interface.

---

## ✨ Features

- **Secure JWT Authentication** (OAuth2 compatible)
- **Role-Based Access Control (RBAC)** — Superadmin vs Invited Admins
- **Permission-aware Sidebar** (only shows allowed sections)
- **Analytics Dashboard** with charts
- **User Management & Moderation** (Ban/Unban users)
- **Admin Invitation System** (Superadmin only)
- **Responsive Design** with dark mode support
- **Professional UI** built with shadcn/ui + Tailwind CSS

---

## 🛠 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui + Radix UI
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod
- **HTTP Client**: Axios
- **Notifications**: Sonner (Toast)
- **Table**: TanStack Table (or shadcn Data Table)

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/teleexam-admin.git
cd teleexam-admin
2. Install dependencies
Bashnpm install
# or
yarn install
3. Environment Variables
Create a .env.local file in the root:
envNEXT_PUBLIC_API_BASE_URL=https://your-backend.com
# Example: https://api.teleexam.ai
4. Run the development server
Bashnpm run dev
# or
yarn dev
Open http://localhost:3000 to view the admin panel.

🔐 Authentication Flow

Go to /login
Enter your email and password
The login request is sent as application/x-www-form-urlencoded with username field (as required by FastAPI)
On success, the JWT access_token is stored in localStorage
All subsequent requests automatically include Authorization: Bearer <token>

Important: Never send X-Telegram-Id or X-Telegram-Secret headers in the admin panel.

📋 Available Permissions

view_stats — Access Analytics & Dashboard
view_users — View user list
ban_user — Ban or unban users
manage_content — Manage exam content (future)
* — Full access (Root Superadmin only)


📁 Project Structure
textsrc/
├── app/
│   ├── (auth)/login/          # Login page
│   ├── dashboard/             # Main layout + protected routes
│   ├── analytics/
│   ├── users/
│   └── admins/                # Superadmin only
├── components/
│   ├── ui/                    # shadcn components
│   ├── layout/                # Sidebar, Navbar
│   ├── charts/
│   └── tables/
├── lib/
│   ├── axios.ts               # Axios instance with interceptor
│   └── utils.ts
├── hooks/
└── types/

🔑 Key API Endpoints

MethodEndpointDescriptionPermissionPOST/admin/auth/loginAdmin loginPublicPOST/admin/auth/inviteInvite new adminSuperadminGET/admin/users/List users (paginated)view_usersPOST/admin/users/{id}/banBan a userban_userPOST/admin/users/{id}/unbanUnban a userban_userGET/admin/stats/dauDaily Active Usersview_statsGET/admin/stats/examsExam statisticsview_statsGET/admin/stats/referralsTop referrersview_stats

🛡️ Security Notes

All admin routes use JWT Bearer Token authentication
No Telegram-specific headers are used
401 responses automatically log out the user
Permissions are enforced both on frontend (UI hiding) and backend


🤝 Contributing

Fork the project
Create your feature branch (git checkout -b feature/amazing-feature)
Commit your changes (git commit -m 'Add amazing feature')
Push to the branch (git push origin feature/amazing-feature)
Open a Pull Request


📄 License
This project is part of the TeleExam AI platform. All rights reserved.

Built for TeleExam AI Admin Operations
