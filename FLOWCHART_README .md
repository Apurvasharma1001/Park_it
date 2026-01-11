
# 🔁 System Flowchart – Component-Level Explanation
---

## 1. Overall System Flow (High-Level)

```
START
  ↓
User Accesses Platform
  ↓
User Authentication
  ↓
Role Identification (Owner / Customer)
  ↓
Role-Based Workflow
  ↓
END
```

The system begins with authentication and branches into different workflows depending on the user role.

---

## 2. Authentication & Role Identification Flow

```
User Enters Login Credentials
  ↓
Validate Credentials
  ↓
Are Credentials Valid?
  ├── NO → Show Error → END
  └── YES
        ↓
   Identify User Role
        ↓
   Redirect to Appropriate Dashboard
```

This ensures secure access and prevents unauthorized role usage.

---

## 3. Parking Owner Workflow

```
Owner Dashboard
  ↓
Add / Manage Parking Lot
  ↓
Enter Parking Details
(Name, Location, Price)
  ↓
Enable Camera-Based Detection?
  ├── NO → Manual Slot Management
  └── YES
        ↓
   Upload Parking Image
        ↓
   Manually Define Parking Slot Regions
        ↓
   Save Slot Configuration
```

Parking owners can choose whether to enable camera-based detection based on available infrastructure.

---

## 4. Camera-Based Detection Flow (Optional Module)

```
Camera Enabled?
  ├── NO → Use Manual Slot Status
  └── YES
        ↓
   Capture Frame
        ↓
   Preprocess Image
   (Grayscale, Blur, Thresholding)
        ↓
   Analyze Slot Regions
        ↓
   Count Foreground Pixels
        ↓
   Slot Occupied?
        ├── YES → Mark Occupied
        └── NO → Mark Vacant
        ↓
   Update Slot Status in Backend
```

This module uses classical OpenCV-based image processing and operates independently of the main backend.

---

## 5. Customer Workflow

```
Customer Dashboard
  ↓
Fetch Current Location
  ↓
Search Nearby Parking Lots
  ↓
Retrieve Slot Availability
  ↓
Is Slot Available?
  ├── NO → Show Alternative Parking Options
  └── YES
        ↓
   Display Parking Details
```

Parking suggestions are based on proximity and real-time availability.

---

## 6. Booking & Allocation Flow

```
Customer Selects Parking Lot
  ↓
Check Latest Slot Availability
  ↓
Slot Still Available?
  ├── NO → Refresh Options
  └── YES
        ↓
   Confirm Booking
        ↓
   Store Booking in Database
        ↓
   Update Slot Status
```

This ensures consistency and prevents double booking.

---

## 7. Navigation Assistance Flow (Round-2 Feature)

```
Booking Confirmed
  ↓
Retrieve Parking Coordinates
  ↓
Generate Navigation Link
  ↓
Redirect to External Maps Service
(Google Maps / OpenStreetMap)
```

Navigation is handled through external map services without implementing custom routing logic.

---

## 8. Unified Slot Availability Service Flow

```
Request Slot Status
  ↓
Check Parking Configuration
  ↓
Camera Enabled?
  ├── YES → Fetch OpenCV-Based Slot Status
  └── NO → Fetch Manual Slot Status
        ↓
   Normalize Slot Data
        ↓
   Return Unified Availability Response
```

This abstraction hides detection complexity from customers.

---

## 9. End-to-End Summary Flow

```
Login
  ↓
Role Detection
  ↓
Owner:
  Add Parking → Configure Slots → Update Availability

Customer:
  Search Parking → Book Slot → Navigate to Parking
```

---
