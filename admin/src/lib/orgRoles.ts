import type { OrgMembershipRole } from '../types/models';

/** Short label shown in dropdowns and the account menu (matches API enum values). */
export const ORG_ROLE_LABEL: Record<OrgMembershipRole, string> = {
    OWNER: 'Owner',
    MANAGER: 'Manager',
    STAFF: 'Staff',
};

/** One-line explanation under the role in the profile menu. */
export const ORG_ROLE_HINT: Record<OrgMembershipRole, string> = {
    OWNER:
        'Full control. Only owners can assign/remove owners or invite as Owner.',
    MANAGER:
        'Runs the portfolio and team (except owner-only actions).',
    STAFF:
        'Portfolio work only — cannot invite people or change anyone’s role.',
};

/** Longer copy for the Team page. */
export const ORG_ROLE_GUIDE: {
    role: OrgMembershipRole;
    title: string;
    body: string;
}[] = [
    {
        role: 'OWNER',
        title: 'Owner',
        body: 'Full access to this organization. Only an owner can invite someone as Owner, change another owner’s role, or remove an owner. There must always be at least one owner.',
    },
    {
        role: 'MANAGER',
        title: 'Manager',
        body: 'Same portfolio access as an owner (properties, renters, leases, payments, tenant signups, receipts). Can invite people as Manager or Staff and change their roles — but not assign or demote owners.',
    },
    {
        role: 'STAFF',
        title: 'Staff',
        body: 'Can do day-to-day portfolio work (properties, renters, leases, payments, receipts, tenant signups) but cannot send team invitations or change anyone’s role. Ask an owner or manager to add new colleagues.',
    },
];

export function orgRoleLabel(role: string | null | undefined): string | null {
    if (!role || !(role in ORG_ROLE_LABEL)) return null;
    return ORG_ROLE_LABEL[role as OrgMembershipRole];
}

export function orgRoleHint(role: string | null | undefined): string | null {
    if (!role || !(role in ORG_ROLE_HINT)) return null;
    return ORG_ROLE_HINT[role as OrgMembershipRole];
}
