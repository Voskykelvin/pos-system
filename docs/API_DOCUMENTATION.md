# API Documentation

This document describes the request and response structures for the main API endpoints of the Jijenge POS system.

## Authentication & Onboarding

### 1. Staff Login
- **Endpoint:** `POST /api/auth/login`
- **Purpose:** Authenticate staff members and return a JWT access token.
- **Request Body:**
  ```json
  {
    "identifier": "cashier@jijenge.com",
    "password": "securepassword123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "usr_90210",
      "name": "Jane Doe",
      "email": "cashier@jijenge.com",
      "role": "cashier",
      "tenantId": "ten_112233",
      "branchId": "br_445566"
    },
    "tenant": {
      "id": "ten_112233",
      "name": "Jijenge Supermarket",
      "plan": "starter",
      "status": "active"
    }
  }
  ```

### 2. Tenant Signup
- **Endpoint:** `POST /api/signup`
- **Purpose:** Onboard a new store owner and auto-provision the default system configurations.
- **Request Body:**
  ```json
  {
    "businessName": "Retail Shop",
    "email": "admin@retailshop.com",
    "password": "securepassword123",
    "currency": "KES",
    "country": "KE",
    "plan": "starter"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "message": "Store provisioned successfully!",
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "tenant": {
      "id": "ten_998877",
      "name": "Retail Shop",
      "currency": "KES",
      "plan": "starter",
      "status": "pending_payment"
    }
  }
  ```

---

## Catalog & Products

### 3. Product Search
- **Endpoint:** `GET /api/products/search`
- **Query Parameters:**
  - `q`: Search query string (minimum 2 chars)
  - `barcode`: Exact match barcode (optional)
- **Response (200 OK):**
  ```json
  [
    {
      "id": "prod_1",
      "sku": "MILK-001",
      "barcode": "6001234567890",
      "name": "Fresh Milk 1L",
      "sellingPrice": 70.00,
      "taxCategory": "standard",
      "Category": {
        "id": "cat_2",
        "name": "Beverages"
      }
    }
  ]
  ```

### 4. Admin Products Listing (Paginated)
- **Endpoint:** `GET /api/admin/products`
- **Query Parameters:**
  - `includeInactive`: Include soft-deleted products (`true`/`false`)
  - `page`: Page index (`default: 1`)
  - `limit`: Page item count (`default: 50`)
- **Response (200 OK):**
  ```json
  {
    "items": [
      {
        "id": "prod_1",
        "name": "Fresh Milk 1L",
        "sku": "MILK-001",
        "sellingPrice": 70.00,
        "stockQuantity": 15
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 50,
    "pages": 1
  }
  ```

---

## Checkout & Sales

### 5. Create Checkout Order
- **Endpoint:** `POST /api/orders/checkout`
- **Request Body:**
  ```json
  {
    "items": [
      {
        "productId": "prod_1",
        "quantity": 2
      }
    ],
    "payments": [
      {
        "method": "cash",
        "amount": 140.00
      }
    ]
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "id": "ord_554433",
    "orderNumber": "SUP-20260706-0001",
    "total": 140.00,
    "status": "completed",
    "paymentStatus": "paid"
  }
  ```
