/**
 * JWT audience — **not** the same as org roles on `OrganizationMember.role`.
 *
 * Naming: call this the **console user** (or “landlord app”) principal. The word
 * `staff` here means “uses the landlord admin console,” not `OrgRole.STAFF`
 * (the lowest org role). Org role (`OWNER` / `MANAGER` / `STAFF`) is per
 * organization on the membership row.
 *
 * - `staff`: landlord admin console (see above).
 * - `tenant`: renter portal.
 * - `platform`: product operator (`User.isPlatformAdmin`).
 */
export type JwtTyp = 'staff' | 'tenant' | 'platform';

export type RequestUser = {
    userId: string;
    typ: JwtTyp;
    renterId?: string;
};
