/**
 * JWT audience — not the same as org roles (`OWNER` / `MANAGER` / `STAFF`).
 * - `staff`: landlord admin console. Org role lives on `OrganizationMember.role`:
 *   who may invite/change roles (owner+manager only) vs portfolio-only (staff).
 * - `tenant`: renter portal.
 * - `platform`: product operator (`User.isPlatformAdmin`).
 */
export type JwtTyp = 'staff' | 'tenant' | 'platform';

export type RequestUser = {
    userId: string;
    typ: JwtTyp;
    renterId?: string;
};
