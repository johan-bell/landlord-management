import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly transporter: Transporter | null;

    constructor(private readonly config: ConfigService) {
        const enabled =
            this.config.get<string>('EMAIL_ENABLED', 'false').toLowerCase() ===
            'true';
        const host = this.config.get<string>('SMTP_HOST', '').trim();
        const port = Number(this.config.get<string>('SMTP_PORT', '587'));
        const user = this.config.get<string>('SMTP_USER', '').trim();
        const pass = this.config.get<string>('SMTP_PASS', '').trim();
        const secure =
            this.config.get<string>('SMTP_SECURE', 'false').toLowerCase() ===
            'true';

        if (!enabled || !host) {
            this.transporter = null;
            if (enabled && !host) {
                this.logger.warn(
                    'EMAIL_ENABLED is true but SMTP_HOST is empty — outbound email disabled',
                );
            }
            return;
        }

        this.transporter = nodemailer.createTransport({
            host,
            port: Number.isFinite(port) ? port : 587,
            secure,
            auth:
                user && pass
                    ? {
                          user,
                          pass,
                      }
                    : undefined,
        });
    }

    isConfigured(): boolean {
        return this.transporter !== null;
    }

    private fromAddress(): string {
        return (
            this.config.get<string>('EMAIL_FROM', '').trim() ||
            this.config.get<string>('SMTP_USER', '').trim() ||
            'no-reply@localhost'
        );
    }

    async sendReceiptRejected(params: {
        to: string | null | undefined;
        organizationName: string;
        topicLine: string;
        note?: string | null;
    }): Promise<void> {
        const to = params.to?.trim();
        if (!to || !this.transporter) {
            return;
        }
        const subject = `Receipt update — ${params.organizationName}`;
        const note = params.note?.trim();
        const text = [
            `Your landlord could not accept the receipt you uploaded (${params.topicLine}).`,
            '',
            note
                ? `Note from the team:\n${note}`
                : 'Please upload a clearer photo or updated proof of payment.',
            '',
            'Sign in to the tenant app to try again.',
        ].join('\n');

        try {
            await this.transporter.sendMail({
                from: this.fromAddress(),
                to,
                subject,
                text,
            });
        } catch (err) {
            this.logger.warn(
                `Failed to send receipt-rejected email to ${to}: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }

    async sendPasswordResetStaff(params: {
        to: string;
        resetUrl: string;
    }): Promise<void> {
        const to = params.to?.trim();
        if (!to || !this.transporter) {
            return;
        }
        try {
            await this.transporter.sendMail({
                from: this.fromAddress(),
                to,
                subject: 'Reset your landlord admin password',
                text: [
                    'You requested a password reset for your landlord admin account.',
                    '',
                    `Open this link to choose a new password (valid for 1 hour):`,
                    params.resetUrl,
                    '',
                    'If you did not request this, you can ignore this email.',
                ].join('\n'),
            });
        } catch (err) {
            this.logger.warn(
                `Failed to send staff password reset to ${to}: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }

    async sendPasswordResetTenant(params: {
        to: string;
        resetUrl: string;
    }): Promise<void> {
        const to = params.to?.trim();
        if (!to || !this.transporter) {
            return;
        }
        try {
            await this.transporter.sendMail({
                from: this.fromAddress(),
                to,
                subject: 'Reset your tenant portal password',
                text: [
                    'You requested a password reset for the tenant portal.',
                    '',
                    `Open this link to choose a new password (valid for 1 hour):`,
                    params.resetUrl,
                    '',
                    'If you did not request this, you can ignore this email.',
                ].join('\n'),
            });
        } catch (err) {
            this.logger.warn(
                `Failed to send tenant password reset to ${to}: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }

    async sendInvitationAcceptedToInviter(params: {
        to: string;
        organizationName: string;
        inviteeEmail: string;
    }): Promise<void> {
        const to = params.to?.trim();
        if (!to || !this.transporter) {
            return;
        }
        try {
            await this.transporter.sendMail({
                from: this.fromAddress(),
                to,
                subject: `${params.inviteeEmail} joined ${params.organizationName}`,
                text: [
                    `${params.inviteeEmail} accepted your team invitation and now has access to ${params.organizationName}.`,
                    '',
                    'You can manage roles and access from the Team screen in the admin app.',
                ].join('\n'),
            });
        } catch (err) {
            this.logger.warn(
                `Failed to send invite-accepted notice to ${to}: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }

    async sendTenantSignupApproved(params: {
        to: string;
        organizationName: string;
    }): Promise<void> {
        const to = params.to?.trim();
        if (!to || !this.transporter) {
            return;
        }
        try {
            await this.transporter.sendMail({
                from: this.fromAddress(),
                to,
                subject: `Your access to ${params.organizationName} is ready`,
                text: [
                    `Good news — ${params.organizationName} approved your tenant portal request.`,
                    '',
                    'Sign in to the tenant app to view your lease and payments.',
                ].join('\n'),
            });
        } catch (err) {
            this.logger.warn(
                `Failed to send signup-approved email to ${to}: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }

    async sendTenantSignupRejected(params: {
        to: string;
        organizationName: string;
    }): Promise<void> {
        const to = params.to?.trim();
        if (!to || !this.transporter) {
            return;
        }
        try {
            await this.transporter.sendMail({
                from: this.fromAddress(),
                to,
                subject: `Update on your request — ${params.organizationName}`,
                text: [
                    `${params.organizationName} did not approve your tenant portal request at this time.`,
                    '',
                    'If you think this is a mistake, contact your landlord directly.',
                ].join('\n'),
            });
        } catch (err) {
            this.logger.warn(
                `Failed to send signup-rejected email to ${to}: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }

    async sendProofApproved(params: {
        to: string | null | undefined;
        organizationName: string;
        topicLine: string;
    }): Promise<void> {
        const to = params.to?.trim();
        if (!to || !this.transporter) {
            return;
        }
        try {
            await this.transporter.sendMail({
                from: this.fromAddress(),
                to,
                subject: `Receipt verified — ${params.organizationName}`,
                text: [
                    `Your uploaded receipt (${params.topicLine}) was verified by ${params.organizationName}.`,
                    '',
                    'Thank you — no further action is needed for this item.',
                ].join('\n'),
            });
        } catch (err) {
            this.logger.warn(
                `Failed to send proof-approved email to ${to}: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }

    async sendRentDueReminder(params: {
        to: string | null | undefined;
        organizationName: string;
        dueDateLabel: string;
        amountLabel: string;
    }): Promise<void> {
        const to = params.to?.trim();
        if (!to || !this.transporter) {
            return;
        }
        try {
            await this.transporter.sendMail({
                from: this.fromAddress(),
                to,
                subject: `Rent reminder — ${params.organizationName}`,
                text: [
                    `This is a reminder that rent of ${params.amountLabel} is due on ${params.dueDateLabel} (${params.organizationName}).`,
                    '',
                    'Sign in to the tenant portal to upload proof of payment if required.',
                ].join('\n'),
            });
        } catch (err) {
            this.logger.warn(
                `Failed to send rent reminder to ${to}: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }

    async sendLeaseExpiryAlert(params: {
        to: string | null | undefined;
        organizationName: string;
        renterName: string;
        unitLabel: string;
        expiryDate: string;
        daysUntilExpiry: number;
    }): Promise<void> {
        const to = params.to?.trim();
        if (!to || !this.transporter) {
            return;
        }
        try {
            await this.transporter.sendMail({
                from: this.fromAddress(),
                to,
                subject: `Lease expiring in ${params.daysUntilExpiry} days — ${params.organizationName}`,
                text: [
                    `This is an advance notice that the lease for ${params.renterName} (${params.unitLabel}) in ${params.organizationName} expires on ${params.expiryDate}.`,
                    '',
                    `Days remaining: ${params.daysUntilExpiry}`,
                    '',
                    'Sign in to the admin panel to review or renew this lease.',
                ].join('\n'),
            });
        } catch (err) {
            this.logger.warn(
                `Failed to send lease expiry alert to ${to}: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }
}
