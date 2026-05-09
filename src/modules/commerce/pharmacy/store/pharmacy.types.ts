export type RxStatus = 'pending' | 'dispensed' | 'cancelled' | 'new' | 'processing';
export type MedicineCategory = 'OTC' | 'Prescription' | 'Supplement';

export interface Batch {
    id: string;
    number: string;
    quantity: number;
    expiryDate: Date;
}

export interface Medicine {
    id: string;
    name: string;
    brand: string; // vs Generic
    genericName?: string;
    unit?: string;
    category: MedicineCategory;
    price: number;
    stock: number;
    minStock: number;
    barcode: string;
    batches: Batch[];
    // Derived total quantity
    description?: string;
    dosage?: string;
    requiresRx: boolean;
}

export interface PrescriptionItem {
    medicineId: string;
    medicineName: string;
    dosage: string;
    quantity: number;
}

export interface Prescription {
    id: string;
    patientName: string;
    doctorName: string;
    items: PrescriptionItem[];
    status: RxStatus;
    createdAt: Date;
    notes?: string;
}

export interface PharmacyState {
    categories: MedicineCategory[];
    inventory: Medicine[];
    prescriptions: Prescription[];

    // Actions
    addMedicine: (med: Medicine) => void;
    updateStock: (medicineId: string, batchId: string, quantityDelta: number) => void;

    addPrescription: (rx: Omit<Prescription, 'id' | 'createdAt' | 'status'>) => void;
    updateRxStatus: (rxId: string, status: RxStatus) => void;

    dispense: (items: { medicineId: string, quantity: number }[]) => void;
}
