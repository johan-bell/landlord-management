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
            note ? `Note from the team:\n${note}` : 'Please upload a clearer photo or updated proof of payment.',
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
}
