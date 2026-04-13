export type Paginated<T> = {
    items: T[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};

export type Organization = {
    id: string;
    name: string;
    slug: string | null;
    createdAt?: string;
};

export type OrgSummary = {
    organizationId: string;
    propertyCount: number;
    unitCount: number;
    occupiedUnitCount: number;
    vacantUnitCount: number;
    renterCount: number;
    leaseCount: number;
};

export type Property = {
    id: string;
    organizationId: string;
    name: string;
    address: string | null;
};

export type Unit = {
    id: string;
    propertyId: string;
    label: string;
    rentAmount: string;
    currency: string;
    status: 'VACANT' | 'OCCUPIED';
    electricityBilling: 'PREPAID_EXTERNAL' | 'METERED_KWH';
    electricityPricePerKwh: string | null;
    waterBilling: 'NONE' | 'METERED_M3';
    waterPricePerM3: string | null;
};

export type Renter = {
    id: string;
    organizationId: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    userId?: string | null;
};

export type LeaseUtilityBill = {
    id: string;
    leaseId: string;
    kind: 'ELECTRICITY' | 'WATER';
    year: number;
    month: number;
    amount: string;
    currency: string;
    dueDate: string;
    status: 'PENDING' | 'PAID' | 'LATE' | 'CANCELLED';
    paidAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type Lease = {
    id: string;
    unitId: string;
    renterId: string;
    startDate: string;
    endDate: string | null;
    rentAmount: string;
    currency: string;
    dueDay: number;
    unit: Unit & { property: Property };
    renter: Renter;
    payments?: Payment[];
    utilityBills?: LeaseUtilityBill[];
};

export type Payment = {
    id: string;
    leaseId: string;
    amount: string;
    currency: string;
    dueDate: string;
    paidAt: string | null;
    status: 'PENDING' | 'PAID' | 'LATE' | 'CANCELLED';
    method: 'CASH' | 'MOBILE_MONEY' | 'BANK' | 'OTHER';
    reference: string | null;
    notes: string | null;
};
