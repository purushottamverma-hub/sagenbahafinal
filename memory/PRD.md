# FPO Management System - Product Requirements Document

## Overview
A cross-platform application for **Sagen Baha Women Farmer Producer Company Limited** to manage inventory, sales, and farmer procurement across multiple outlets.

## Tech Stack
- **Frontend**: React Native with Expo (PWA - works on Android & Web browsers)
- **Backend**: FastAPI with Python
- **Database**: MongoDB
- **Authentication**: JWT-based custom authentication

## Features Implemented

### 1. Authentication & User Management
- Secure login with username/password
- Role-based access (Admin vs Agent)
- Password change functionality
- Admin can create agents with outlet assignment
- Default admin: `admin` / `admin123`

### 2. Bilingual Support (Hindi & English)
- Language toggle on login and settings screen
- All UI labels translated
- Default language: Hindi

### 3. Outlet Management (Admin)
- Create outlets with name, address, contact person
- Central office designation
- View all outlets

### 4. Product Management (Admin)
- Create products with English and Hindi names
- Units: kg, litre, piece, packet
- Categories: Input (seeds, bio-inputs) or Output (produce)
- Pre-populated products:
  - अग्निस्त्र (Agnistra) - Litre
  - संजीविनी खाद (Sanjeevini Compost) - Kg
  - मल्टी सीड एक्स्ट्रेक्ट (Multi Seed Extract) - Litre
  - जीवामृत (Jeevamrit) - Litre
  - धान बीज (Paddy Seeds) - Kg

### 5. Stock Management
- Add stock to outlets
- Allocate stock between outlets (Admin)
- Report damaged stock with mandatory reason
- Consolidated stock view across all outlets
- Low stock alerts (< 10 units)

### 6. Sales & Billing
- Create sales with multiple items
- Auto-generated bill numbers (BILL{YYYYMMDD}{XXXX})
- Payment modes: Cash, Online, Credit, Partial
- Customer selection or walk-in
- Discount support
- Stock auto-deduction on sale

### 7. Customer Management
- Customer profiles with name, mobile, village
- Customer ledger tracking (Admin only)
- Outstanding balance tracking
- Credit payment recording

### 8. Farmer Management
- Farmer profiles with member status
- Village and mobile tracking
- Farmer ledger for procurement tracking
- Payment tracking for farmers

### 9. Dashboard
- Today's sales summary
- Monthly sales summary
- Payment mode breakdown (Cash/Online/Credit)
- Quick stats (Customers, Farmers, Products, Outlets)
- Outstanding dues (Customer & Farmer)
- Low stock alerts

### 10. Reports (Admin)
- Excel export for customer ledger
- Excel export for farmer ledger
- Sales report with date filters

## API Endpoints

### Authentication
- POST `/api/auth/login` - Login
- POST `/api/auth/change-password` - Change password
- GET `/api/auth/me` - Get current user

### Users (Admin)
- POST `/api/users` - Create user
- GET `/api/users` - List users
- PUT `/api/users/{id}` - Update user
- DELETE `/api/users/{id}` - Deactivate user

### Outlets
- POST `/api/outlets` - Create outlet
- GET `/api/outlets` - List outlets
- PUT `/api/outlets/{id}` - Update outlet
- DELETE `/api/outlets/{id}` - Deactivate outlet

### Products
- POST `/api/products` - Create product
- GET `/api/products` - List products
- PUT `/api/products/{id}` - Update product
- DELETE `/api/products/{id}` - Deactivate product

### Stock
- GET `/api/stock` - Get stock
- GET `/api/stock/consolidated` - Get consolidated stock
- POST `/api/stock/add` - Add stock
- POST `/api/stock/allocate` - Allocate stock
- POST `/api/stock/damage` - Report damage

### Sales
- POST `/api/sales` - Create sale
- GET `/api/sales` - List sales
- GET `/api/sales/{id}` - Get sale details

### Customers
- POST `/api/customers` - Create customer
- GET `/api/customers` - List customers
- GET `/api/customers/{id}/ledger` - Get ledger
- POST `/api/customers/payment` - Record payment

### Farmers
- POST `/api/farmers` - Create farmer
- GET `/api/farmers` - List farmers
- GET `/api/farmers/{id}/ledger` - Get ledger
- POST `/api/farmers/purchase` - Record purchase
- POST `/api/farmers/payment` - Record payment

### Reports
- GET `/api/reports/customers/export` - Export customer ledger
- GET `/api/reports/farmers/export` - Export farmer ledger
- GET `/api/reports/sales/export` - Export sales report

## User Interfaces

### Admin Interface (5 tabs)
1. **Dashboard** - Overview and stats
2. **Sales** - Create and view sales
3. **Stock** - Manage inventory
4. **Manage** - Outlets, Products, Customers, Farmers, Agents
5. **Settings** - Language, password, logout

### Agent Interface (4 tabs)
1. **Dashboard** - Overview and quick actions
2. **Sales** - Create and view sales (own outlet only)
3. **Stock** - View and manage own outlet stock
4. **Settings** - Language, password, logout

## Currency & Units
- Currency: Indian Rupee (₹)
- Weight: Kilograms (kg)

## Setup Instructions

### Initialize System
```bash
curl -X POST http://localhost:8001/api/init/setup
```
This creates:
- Default admin user (admin/admin123)
- Central office outlet
- Default products

### Login
Navigate to `/` or `/(auth)/login` and use:
- Username: `admin`
- Password: `admin123`

## Future Enhancements
- Offline-first functionality with sync
- PDF bill printing
- QR code scanning for products
- Mobile push notifications
- Logo upload for FPO branding
- Multi-outlet agent assignment
