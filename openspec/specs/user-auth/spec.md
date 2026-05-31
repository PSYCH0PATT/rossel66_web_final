# User Authentication

## Purpose
Система аутентификации пользователей для личного кабинета. Обеспечивает вход по логину/паролю, управление сессиями через localStorage и разграничение доступа на основе ролей (admin/artist).

## Requirements

### Requirement: User Login
The system SHALL allow users to login to the dashboard using username and password. (Система ДОЛЖНА позволять пользователям входить в личный кабинет по логину и паролю.)

#### Scenario: Successful admin login
- **WHEN** пользователь вводит корректный логин и пароль администратора
- **THEN** система перенаправляет на `/dashboard/admin/dashboard`
- **AND** сохраняет данные сессии в localStorage

#### Scenario: Successful artist login
- **WHEN** пользователь вводит корректный логин и пароль артиста
- **THEN** система перенаправляет на `/dashboard/artist/[username]/dashboard`
- **AND** сохраняет данные сессии в localStorage

#### Scenario: Failed login
- **WHEN** пользователь вводит неверный логин или пароль
- **THEN** система показывает сообщение об ошибке
- **AND** не перенаправляет пользователя

### Requirement: Session Management
The system SHALL manage user session via localStorage. (Система ДОЛЖНА управлять сессией пользователя через localStorage.)

#### Scenario: Session persistence
- **WHEN** пользователь авторизован и обновляет страницу
- **THEN** сессия сохраняется
- **AND** пользователь остается авторизованным

#### Scenario: Logout
- **WHEN** пользователь нажимает "Выйти"
- **THEN** данные сессии удаляются из localStorage
- **AND** пользователь перенаправляется на страницу входа

### Requirement: Role-Based Access Control
The system SHALL restrict page access based on user role. (Система ДОЛЖНА ограничивать доступ к страницам на основе роли пользователя.)

#### Scenario: Admin access to admin pages
- **WHEN** администратор пытается получить доступ к `/dashboard/admin/*`
- **THEN** доступ разрешен

#### Scenario: Artist access to admin pages
- **WHEN** артист пытается получить доступ к `/dashboard/admin/*`
- **THEN** доступ запрещен
- **AND** пользователь перенаправляется на свой дашборд

#### Scenario: Artist access to own pages
- **WHEN** артист пытается получить доступ к `/dashboard/artist/[own-username]/*`
- **THEN** доступ разрешен

#### Scenario: Artist access to other artist pages
- **WHEN** артист пытается получить доступ к `/dashboard/artist/[other-username]/*`
- **THEN** доступ запрещен

### Requirement: User CRUD Operations
The system SHALL allow administrators to manage users via CRUD operations. (Система ДОЛЖНА позволять администратору управлять пользователями.)

#### Scenario: Create user
- **WHEN** администратор создает нового пользователя через API
- **THEN** пользователь сохраняется в Supabase Postgres (`User` table)
- **AND** возвращается созданный пользователь

#### Scenario: Update user
- **WHEN** администратор обновляет данные пользователя
- **THEN** изменения сохраняются в Supabase Postgres

#### Scenario: Delete user
- **WHEN** администратор удаляет пользователя
- **THEN** пользователь удаляется из Supabase Postgres

## Technical Details

### Storage
- Пользователи хранятся в **Supabase Postgres** (`User` via Prisma)
- Сессия: httpOnly cookie `rossel_session` (не localStorage для domain data)

### Components
- `components/auth-check.tsx` — HOC для проверки авторизации
- `app/dashboard/login/page.tsx` — страница входа

### API
- `GET /api/users` — список пользователей
- `POST /api/users` — создать пользователя
- `PUT /api/users` — обновить пользователя
- `DELETE /api/users?id=` — удалить пользователя

