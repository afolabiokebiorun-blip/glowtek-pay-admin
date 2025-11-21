-- Add missing processors to the payment_processor enum
ALTER TYPE payment_processor ADD VALUE IF NOT EXISTS 'flutterwave';
ALTER TYPE payment_processor ADD VALUE IF NOT EXISTS 'stripe';
ALTER TYPE payment_processor ADD VALUE IF NOT EXISTS 'paypal';
ALTER TYPE payment_processor ADD VALUE IF NOT EXISTS 'wise';
ALTER TYPE payment_processor ADD VALUE IF NOT EXISTS 'coinbase';
ALTER TYPE payment_processor ADD VALUE IF NOT EXISTS 'nowpayments';
ALTER TYPE payment_processor ADD VALUE IF NOT EXISTS 'bitpay';
ALTER TYPE payment_processor ADD VALUE IF NOT EXISTS 'coinpayments';
ALTER TYPE payment_processor ADD VALUE IF NOT EXISTS 'binancepay';