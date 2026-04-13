import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import StripeSdk from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingService {
    private stripe: InstanceType<typeof StripeSdk> | null = null;

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        const key = this.config.get<string>('STRIPE_SECRET_KEY');
        if (key) {
            this.stripe = new StripeSdk(key);
        }
    }

    isEnabled() {
        return Boolean(this.stripe && this.config.get('STRIPE_PRICE_ID'));
    }

    async createCheckoutSession(
        orgId: string,
        successUrl: string,
        cancelUrl: string,
    ) {
        if (!this.stripe) {
            throw new BadRequestException(
                'Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID in api/.env',
            );
        }
        const priceId = this.config.get<string>('STRIPE_PRICE_ID');
        if (!priceId) {
            throw new BadRequestException('STRIPE_PRICE_ID is missing');
        }

        const org = await this.prisma.organization.findUnique({
            where: { id: orgId },
        });
        if (!org) {
            throw new BadRequestException('Organization not found');
        }

        let customerId = org.stripeCustomerId ?? undefined;
        if (!customerId) {
            const customer = await this.stripe.customers.create({
                name: org.name,
                metadata: { organizationId: org.id },
            });
            customerId = customer.id;
            await this.prisma.organization.update({
                where: { id: orgId },
                data: { stripeCustomerId: customerId },
            });
        }

        const session = await this.stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: { organizationId: orgId },
        });

        return { url: session.url };
    }
}
