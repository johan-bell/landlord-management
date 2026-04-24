import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import nodemailer, { type Transporter } from 'nodemailer';

const TEMPLATES_DIR = join(__dirname, 'templates');

function loadTemplate(name: string): Handlebars.TemplateDelegate {
    const src = readFileSync(join(TEMPLATES_DIR, `${name}.hbs`), 'utf8');
    return Handlebars.compile(src);
}

const baseTemplate = loadTemplate('base');

function renderEmail(
    templateName: string,
    data: Record<string, unknown>,
): string {
    const bodyTemplate = loadTemplate(templateName);
    const body = bodyTemplate(data);
    return baseTemplate({ ...data, body });
}

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
            auth: user && pass ? { user, pass } : undefined,
        });
    }

    isConfigured(): boolean {
        return this.transporter !== null;
    }

    async verifySmtp(): Promise<void> {
        if (!this.transporter) throw new Error('SMTP not configured');
        await this.transporter.verify();
    }

    private fromAddress(): string {
        return (
            this.config.get<string>('EMAIL_FROM', '').trim() ||
            this.config.get<string>('SMTP_USER', '').trim() ||
            'no-reply@localhost'
        );
    }

    private async send(
        to: string,
        subject: string,
        templateName: string,
        data: Record<string, unknown>,
    ): Promise<void> {
        if (!this.transporter) return;
        const html = renderEmail(templateName, { ...data, subject });
        try {
            await this.transporter.sendMail({
                from: this.fromAddress(),
                to,
                subject,
                html,
                text: html
                    .replace(/<[^>]+>/g, '')
                    .replace(/\s{2,}/g, ' ')
                    .trim(),
            });
        } catch (err) {
            this.logger.warn(
                `Failed to send "${subject}" to ${to}: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }

    async sendReceiptRejected(params: {
        to: string | null | undefined;
        organizationName: string;
        topicLine: string;
        note?: string | null;
    }): Promise<void> {
        const to = params.to?.trim();
        if (!to) return;
        await this.send(
            to,
            `Receipt update — ${params.organizationName}`,
            'receipt-rejected',
            {
                organizationName: params.organizationName,
                topicLine: params.topicLine,
                note: params.note?.trim() || null,
            },
        );
    }

    async sendPasswordResetStaff(params: {
        to: string;
        resetUrl: string;
    }): Promise<void> {
        const to = params.to?.trim();
        if (!to) return;
        await this.send(
            to,
            'Reset your landlord admin password',
            'password-reset-staff',
            {
                organizationName: 'Landlord Admin',
                resetUrl: params.resetUrl,
            },
        );
    }

    async sendPasswordResetTenant(params: {
        to: string;
        resetUrl: string;
    }): Promise<void> {
        const to = params.to?.trim();
        if (!to) return;
        await this.send(
            to,
            'Reset your tenant portal password',
            'password-reset-tenant',
            {
                organizationName: 'Tenant Portal',
                resetUrl: params.resetUrl,
            },
        );
    }

    async sendInvitationAcceptedToInviter(params: {
        to: string;
        organizationName: string;
        inviteeEmail: string;
    }): Promise<void> {
        const to = params.to?.trim();
        if (!to) return;
        await this.send(
            to,
            `${params.inviteeEmail} joined ${params.organizationName}`,
            'invitation-accepted',
            {
                organizationName: params.organizationName,
                inviteeEmail: params.inviteeEmail,
            },
        );
    }

    async sendTenantSignupApproved(params: {
        to: string;
        organizationName: string;
    }): Promise<void> {
        const to = params.to?.trim();
        if (!to) return;
        await this.send(
            to,
            `Your access to ${params.organizationName} is ready`,
            'signup-approved',
            { organizationName: params.organizationName },
        );
    }

    async sendTenantSignupRejected(params: {
        to: string;
        organizationName: string;
    }): Promise<void> {
        const to = params.to?.trim();
        if (!to) return;
        await this.send(
            to,
            `Update on your request — ${params.organizationName}`,
            'signup-rejected',
            { organizationName: params.organizationName },
        );
    }

    async sendProofApproved(params: {
        to: string | null | undefined;
        organizationName: string;
        topicLine: string;
    }): Promise<void> {
        const to = params.to?.trim();
        if (!to) return;
        await this.send(
            to,
            `Receipt verified — ${params.organizationName}`,
            'proof-approved',
            {
                organizationName: params.organizationName,
                topicLine: params.topicLine,
            },
        );
    }

    async sendRentDueReminder(params: {
        to: string | null | undefined;
        organizationName: string;
        dueDateLabel: string;
        amountLabel: string;
    }): Promise<void> {
        const to = params.to?.trim();
        if (!to) return;
        await this.send(
            to,
            `Rent reminder — ${params.organizationName}`,
            'rent-reminder',
            {
                organizationName: params.organizationName,
                dueDateLabel: params.dueDateLabel,
                amountLabel: params.amountLabel,
            },
        );
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
        if (!to) return;
        await this.send(
            to,
            `Lease expiring in ${params.daysUntilExpiry} days — ${params.organizationName}`,
            'lease-expiry-alert',
            {
                organizationName: params.organizationName,
                renterName: params.renterName,
                unitLabel: params.unitLabel,
                expiryDate: params.expiryDate,
                daysUntilExpiry: params.daysUntilExpiry,
            },
        );
    }
}
