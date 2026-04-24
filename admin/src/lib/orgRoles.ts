import type { OrgMembershipRole } from '../types/models';

/** Short label shown in dropdowns and the account menu (matches API enum values). */
export const ORG_ROLE_LABEL: Record<OrgMembershipRole, string> = {
    OWNER: 'Owner',
    MANAGER: 'Manager',
    STAFF: 'Staff',
};

/** One-line explanation under the role in the profile menu. */
export const ORG_ROLE_HINT: Record<OrgMembershipRole, string> = {
    OWNER: 'Full control. Only owners can assign/remove owners, delete the org, or invite as Owner.',
    MANAGER:
        'Portfolio + approvals + billing; cannot manage owners or delete the org.',
    STAFF: 'Day-to-day portfolio work; no team admin, approvals, billing, or org settings.',
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
        body: 'Full portfolio access. Only an owner can invite someone as Owner, change another owner’s role, remove an owner, or delete the organization. Owners and managers can update organization details; there must always be at least one owner.',
    },
    {
        role: 'MANAGER',
        title: 'Manager',
        body: 'Same portfolio access as an owner. With owners, can approve or reject tenant signups and receipt verification, mark charges paid when collecting cash, and run billing checkout. Can invite Manager or Staff and change their roles — not owners. Cannot delete the organization.',
    },
    {
        role: 'STAFF',
        title: 'Staff',
        body: 'Can manage properties, renters, leases, and view pending receipts or tenant signups — but cannot approve/reject signups or receipts, mark rent or utilities paid, use billing checkout, or change organization settings. On the Team page, email and phone are hidden for privacy. Ask an owner or manager for team changes and approvals.',
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
