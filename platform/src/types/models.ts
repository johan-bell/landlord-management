export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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
};
