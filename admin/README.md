# Parkit Admin Panel

This is a separate admin panel for the Parkit parking management system. It allows administrators to view and manage all customers, owners, bookings, and parking lots.

## Features

- **Dashboard**: Overview statistics including total customers, owners, parking lots, bookings, and revenue
- **Customer Management**: View all customers and their booking history
- **Owner Management**: View all owners, their parking lots, and related bookings
- **Booking Management**: View all bookings across the system
- **Parking Lot Management**: View all parking lots and their details

## Setup

1. Install dependencies:
```bash
cd admin
npm install
```

2. Start the development server:
```bash
npm run dev
```

The admin panel will run on `http://localhost:3001`

## Admin Access

The admin panel is accessible without login. Simply navigate to `http://localhost:3001/admin` to access the dashboard.

## Routes

- `/admin` or `/admin/dashboard` - Dashboard with statistics
- `/admin/customers` - List of all customers
- `/admin/customers/:id` - Customer details and bookings
- `/admin/owners` - List of all owners
- `/admin/owners/:id` - Owner details, parking lots, and bookings
- `/admin/bookings` - List of all bookings
- `/admin/parking-lots` - List of all parking lots

## API Endpoints

The admin panel uses the following API endpoints (no authentication required):

- `GET /api/admin/stats` - Get dashboard statistics
- `GET /api/admin/customers` - Get all customers
- `GET /api/admin/customers/:id` - Get customer details
- `GET /api/admin/owners` - Get all owners
- `GET /api/admin/owners/:id` - Get owner details
- `GET /api/admin/bookings` - Get all bookings
- `GET /api/admin/parking-lots` - Get all parking lots

