import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default('development'),
    PORT: Joi.number().integer().min(1).max(65535).default(3000),

    DATABASE_URL: Joi.string().uri().required(),

    JWT_SECRET: Joi.string().min(16).required(),
    JWT_REFRESH_SECRET: Joi.string().min(16).optional(),

    CORS_ORIGIN: Joi.string().optional(),

    EMAIL_ENABLED: Joi.string().valid('true', 'false').default('false'),
    SMTP_HOST: Joi.string().when('EMAIL_ENABLED', {
        is: 'true',
        then: Joi.required(),
        otherwise: Joi.optional().allow(''),
    }),
    SMTP_PORT: Joi.number().integer().default(587),
    SMTP_USER: Joi.string().optional().allow(''),
    SMTP_PASS: Joi.string().optional().allow(''),
    SMTP_SECURE: Joi.string().valid('true', 'false').default('false'),
    EMAIL_FROM: Joi.string().optional().allow(''),

    S3_ENDPOINT: Joi.string().optional().allow(''),
    S3_REGION: Joi.string().optional().allow(''),
    S3_ACCESS_KEY: Joi.string().optional().allow(''),
    S3_SECRET_KEY: Joi.string().optional().allow(''),
    S3_BUCKET: Joi.string().optional().allow(''),
    S3_FORCE_PATH_STYLE: Joi.string().valid('true', 'false').default('true'),

    TENANT_PUBLIC_URL: Joi.string().optional().allow(''),
    ADMIN_PUBLIC_URL: Joi.string().optional().allow(''),

    RENT_REMINDER_DAYS_BEFORE: Joi.number().integer().min(0).default(3),

    SENTRY_DSN: Joi.string().optional().allow(''),
}).options({ allowUnknown: true });
