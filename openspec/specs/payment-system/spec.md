# Payment System

## Purpose
Система выплат роялти артистам. Расчет баланса на основе отчетов, ведение истории выплат, отображение баланса в кабинете артиста и сводной статистики в админ-панели.

## Requirements

### Requirement: Balance Calculation
The system SHALL calculate artist balance based on assigned reports.

#### Scenario: Calculate total earned
- **WHEN** report is assigned to artist
- **THEN** amount from report is added to `totalEarned`

#### Scenario: Calculate pending amount
- **WHEN** balance is calculated
- **THEN** `pending = totalEarned - totalPaid`

### Requirement: Payment History
The system SHALL maintain payment history for all artists.

#### Scenario: View payment history
- **WHEN** administrator opens payments page
- **THEN** list of all payments is displayed
- **AND** grouped by artist

#### Scenario: Filter by artist
- **WHEN** administrator filters by artist
- **THEN** only that artist's payments are shown

### Requirement: Create Payment
The system SHALL allow creating payments to artists.

#### Scenario: Create payment
- **WHEN** administrator creates payment for artist
- **THEN** amount is added to `totalPaid`
- **AND** `pending` is decreased
- **AND** payment is recorded in history

### Requirement: Artist Balance View
The system SHALL display artist's own balance and payment history in their dashboard.

#### Scenario: View own balance
- **WHEN** artist opens "Payments" page
- **THEN** current balance is displayed
- **AND** payment history is shown

#### Scenario: View balance breakdown
- **WHEN** artist views balance
- **THEN** sees: total earned, total paid, pending payment

## Technical Details

### Storage
- Balances stored in `data/balances.json`
- Payment history in `data/payments.json`

### Components
- `app/dashboard/admin/payments/page.tsx` — payment management
- `app/dashboard/artist/[username]/payments/page.tsx` — artist payments

### API
- `GET /api/balance/[artistId]` — artist balance
- `GET /api/payments` — payment history
- `POST /api/payments` — create payment
