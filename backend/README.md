# One OS Backend

## Requirements

- [Bun](https://bun.sh/) v1.0+

## Setup

```bash
cd backend
bun install
bun run db:seed
bun run dev
```

## API Endpoints

### Auth
- `POST /api/auth/login` - Login with email
- `POST /api/auth/logout` - Logout
- `GET /api/auth/session` - Get current session (requires auth)

### Inventory
- `GET /api/inventory` - List all inventory items
- `GET /api/inventory/:id` - Get single item
- `PATCH /api/inventory/:id/stock` - Update stock level
- `POST /api/inventory` - Create new item

### Orders
- `GET /api/products/search?barcode=` - Search product by barcode
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order details

### Suppliers
- `GET /api/suppliers` - List all suppliers
- `POST /api/suppliers/procurement/orders` - Create purchase order

## Development

```bash
bun run dev
```

Server runs on `http://localhost:3001`
