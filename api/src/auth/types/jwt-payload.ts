/**
 * JWT audience — not the same as org roles (`OWNER` / `MANAGER` / `STAFF`).
 * - `staff`: landlord admin console (any org membership role).
 * - `tenant`: renter portal.
 * - `platform`: product operator (`User.isPlatformAdmin`).
 */
export type JwtTyp = 'staff' | 'tenant' | 'platform';

export type RequestUser = {
    userId: string;
    typ: JwtTyp;
    renterId?: string;
};
