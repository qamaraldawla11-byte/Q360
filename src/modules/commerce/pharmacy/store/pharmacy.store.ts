import { create } from 'zustand';
import type { PharmacyState, Medicine, Prescription } from './pharmacy.types';

// Mock Data
const INITIAL_INVENTORY: Medicine[] = [
    {
        id: 'med-1', name: 'Amoxicillin 500mg', brand: 'Amoxil', category: 'Prescription', requiresRx: true, price: 15.50, barcode: '888123456',
        stock: 170, minStock: 20, unit: 'tablets',
        batches: [
            { id: 'b1', number: 'BN-7721', quantity: 50, expiryDate: new Date('2025-12-31') },
            { id: 'b2', number: 'BN-7722', quantity: 120, expiryDate: new Date('2027-06-30') }
        ]
    },
    {
        id: 'med-2', name: 'Paracetamol 500mg', brand: 'Panadol', category: 'OTC', requiresRx: false, price: 5.00, barcode: '888654321',
        description: 'Pain reliever and fever reducer',
        stock: 200, minStock: 50, unit: 'tablets',
        batches: [
            { id: 'b3', number: 'BN-9901', quantity: 200, expiryDate: new Date('2026-01-15') }
        ]
    },
    {
        id: 'med-3', name: 'Vitamin C 1000mg', brand: 'NatureBest', category: 'Supplement', requiresRx: false, price: 12.00, barcode: '888111222',
        stock: 15, minStock: 30, unit: 'bottles',
        batches: [
            { id: 'b4', number: 'BN-3321', quantity: 15, expiryDate: new Date('2024-02-20') } // Expiring soon
        ]
    },
    {
        id: 'med-4', name: 'Lisinopril 10mg', brand: 'Zestril', category: 'Prescription', requiresRx: true, price: 18.00, barcode: '888999000',
        stock: 0, minStock: 10, unit: 'tablets',
        batches: [
            { id: 'b5', number: 'BN-4455', quantity: 0, expiryDate: new Date('2025-05-20') } // Out of stock
        ]
    }
];

const INITIAL_RX: Prescription[] = [
    {
        id: 'rx-001', patientName: 'John Doe', doctorName: 'Dr. Sarah Smith', status: 'pending', createdAt: new Date(),
        items: [{ medicineId: 'med-1', medicineName: 'Amoxicillin 500mg', dosage: '1 tablet 3x daily', quantity: 21 }]
    },
    {
        id: 'rx-002', patientName: 'Jane Roe', doctorName: 'Dr. Emily Blunt', status: 'dispensed', createdAt: new Date(Date.now() - 86400000),
        items: [{ medicineId: 'med-4', medicineName: 'Lisinopril 10mg', dosage: '1 tablet daily', quantity: 30 }]
    }
];

export const usePharmacyStore = create<PharmacyState>((set) => ({
    inventory: INITIAL_INVENTORY,
    categories: ['OTC', 'Prescription', 'Supplement'],
    prescriptions: INITIAL_RX,

    addMedicine: (med) => set((state) => ({ inventory: [...state.inventory, med] })),

    updateStock: (medicineId, batchId, quantityDelta) => set((state) => ({
        inventory: state.inventory.map(med => {
            if (med.id !== medicineId) return med;
            return {
                ...med,
                batches: med.batches.map(b => b.id === batchId ? { ...b, quantity: Math.max(0, b.quantity + quantityDelta) } : b)
            };
        })
    })),

    addPrescription: (rxData) => set((state) => ({
        prescriptions: [{ ...rxData, id: `rx-${Date.now()}`, createdAt: new Date(), status: 'pending' }, ...state.prescriptions]
    })),

    updateRxStatus: (rxId, status) => set((state) => ({
        prescriptions: state.prescriptions.map(p => p.id === rxId ? { ...p, status } : p)
    })),

    dispense: (items) => set((state) => {
        // Allow dispensing from first available batch (FIFO logic mocked)
        const newInventory = state.inventory.map(med => {
            const itemToDispense = items.find(i => i.medicineId === med.id);
            if (!itemToDispense) return med;

            let remainingToDispense = itemToDispense.quantity;
            const newBatches = med.batches.map(batch => {
                if (remainingToDispense <= 0) return batch;
                const taken = Math.min(batch.quantity, remainingToDispense);
                remainingToDispense -= taken;
                return { ...batch, quantity: batch.quantity - taken };
            });

            return { ...med, batches: newBatches };
        });
        return { inventory: newInventory };
    })
}));
