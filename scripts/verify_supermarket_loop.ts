
// Verification script for Phase 1 Loop
// Run with: npx tsx scripts/verify_supermarket_loop.ts

import { inventoryService } from '../src/core/services/inventory.service';
import { procurementService } from '../src/core/services/procurement.service';
import { ordersService } from '../src/core/services/orders.service';
import { useSupermarketStore } from '../src/modules/commerce/supermarket/store/supermarket.store';

async function runVerification() {
    console.log("🚀 Starting System Verification: Supermarket Loop");

    // 1. Initial State
    console.log("\n1️⃣  Loading Inventory...");
    await inventoryService.getInventory();
    const inventory = useSupermarketStore.getState().inventory;
    const milk = inventory.find(i => i.id === '1'); // 'Fresh Milk'

    if (!milk) {
        console.error("❌ Critical: Milk not found in inventory!");
        process.exit(1);
    }

    console.log(`✅ Inventory Loaded. Milk Stock: ${milk.current}`);
    const initialStock = milk.current;

    // 2. Procurement Flow (Order 50 units)
    console.log("\n2️⃣  Executing Procurement (Ordering 50 units)...");
    await procurementService.createPurchaseOrder(milk.id, 50);

    const stockAfterProcurement = useSupermarketStore.getState().inventory.find(i => i.id === '1')?.current;
    console.log(`✅ Procurement Complete. New Stock: ${stockAfterProcurement}`);

    if (stockAfterProcurement !== initialStock + 50) {
        console.error(`❌ Procurement Failed! Expected ${initialStock + 50}, got ${stockAfterProcurement}`);
        process.exit(1);
    }

    // 3. POS Flow (Sell 5 units)
    console.log("\n3️⃣  Executing POS Sale (Scanning Barcode '123456' x 5)...");
    // '123456' is mock barcode for Milk
    const product = await ordersService.findProduct('123456');
    if (!product) {
        console.error("❌ Product lookup failed!");
        process.exit(1);
    }
    console.log(`   Found Product: ${product.name}`);

    // Simulate functionality of adding to cart (which is usually UI driven but we call store directly)
    const { addToCart } = useSupermarketStore.getState();
    addToCart({ id: product.id, name: product.name, price: product.price }); // Qty 1
    // Add 4 more
    addToCart({ id: product.id, name: product.name, price: product.price });
    addToCart({ id: product.id, name: product.name, price: product.price });
    addToCart({ id: product.id, name: product.name, price: product.price });
    addToCart({ id: product.id, name: product.name, price: product.price });

    const cart = useSupermarketStore.getState().cart;
    console.log(`   Cart has ${cart.length} items. Processing Sale...`);

    // Process Sale
    await ordersService.processSale(cart);

    const finalStock = useSupermarketStore.getState().inventory.find(i => i.id === '1')?.current;
    console.log(`✅ Sale Processed. Final Stock: ${finalStock}`);

    // Verification
    if (finalStock !== stockAfterProcurement - 5) {
        console.error(`❌ POS Failed! Expected ${stockAfterProcurement - 5}, got ${finalStock}`);
        process.exit(1);
    }

    console.log("\n🎉 SUCCESS: Procurement -> Inventory -> POS loop is fully functional!");
}

runVerification().catch(console.error);
