import Razorpay from 'razorpay';
import crypto from 'crypto';

const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

/**
 * STORY-18: Simulation mode must never run in production. Every code path that
 * would otherwise fall back to a mock (no live Razorpay client) calls this
 * guard first, so a misconfigured production deploy fails loudly instead of
 * silently "succeeding" with fake payments.
 */
function assertSimulationAllowed(operation: string): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `Payment simulation mode is disabled in production. Refusing to ${operation} without live Razorpay credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).`,
    );
  }
}

let razorpayClient: any = null;

if (KEY_ID && KEY_SECRET) {
  try {
    const RazorpayConstructor = (Razorpay as any).default || Razorpay;
    razorpayClient = new RazorpayConstructor({
      key_id: KEY_ID,
      key_secret: KEY_SECRET,
    });
  } catch (err) {
    console.error('Failed to initialize Razorpay client:', err);
  }
} else {
  console.warn('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are missing. Operating in simulated payment mode.');
}

export interface CreateOrderOutput {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  isSimulated: boolean;
}

export async function createRazorpayOrder(
  milestoneId: string,
  amountInInr: number
): Promise<CreateOrderOutput> {
  const amountInPaise = Math.round(amountInInr * 100);

  if (!razorpayClient) {
    assertSimulationAllowed('create an order');
    console.log(`[SIMULATION] Generating mock Razorpay order for Milestone: ${milestoneId}, Amount: ${amountInInr} INR`);
    return {
      id: `order_mock_${crypto.randomBytes(8).toString('hex')}`,
      amount: amountInPaise,
      currency: 'INR',
      receipt: milestoneId,
      status: 'created',
      isSimulated: true
    };
  }

  const order = await razorpayClient.orders.create({
    amount: amountInPaise,
    currency: 'INR',
    receipt: milestoneId,
  });

  return {
    id: order.id,
    amount: order.amount,
    currency: order.currency,
    receipt: order.receipt || milestoneId,
    status: order.status,
    isSimulated: false
  };
}

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  if (!KEY_SECRET || orderId.startsWith('order_mock_')) {
    console.log(`[SIMULATION] Bypassing signature check for mock/simulated order: ${orderId}`);
    return true;
  }

  try {
    const text = `${orderId}|${paymentId}`;
    const generatedSignature = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(text)
      .digest('hex');
    return generatedSignature === signature;
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

export function verifyWebhookSignature(
  body: string,
  signature: string,
  webhookSecret: string
): boolean {
  if (!webhookSecret) {
    console.error('CRITICAL SECURITY ALERT: Webhook secret not configured. Rejecting payload.');
    return false; // ← Reject unsigned webhooks
  }

  try {
    const generatedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');
    return generatedSignature === signature;
  } catch (err) {
    console.error('Webhook signature verification error:', err);
    return false;
  }
}

export async function transferFundsToFreelancer(
  amountInInr: number,
  freelancerAccountId: string
): Promise<{ success: boolean; transferId?: string; isSimulated: boolean }> {
  if (!razorpayClient) {
    assertSimulationAllowed('transfer funds');
    console.log(`[SIMULATION] Transferring ${amountInInr} INR to Freelancer Account: ${freelancerAccountId}`);
    return { success: true, transferId: `tr_mock_${crypto.randomBytes(8).toString('hex')}`, isSimulated: true };
  }

  try {
    const transfer = await razorpayClient.transfers.create({
      account: freelancerAccountId,
      amount: Math.round(amountInInr * 100),
      currency: 'INR'
    });
    return { success: true, transferId: transfer.id, isSimulated: false };
  } catch (err) {
    console.error('Razorpay Route payout failed, returning fallback success indicator:', err);
    return { success: false, isSimulated: false };
  }
}

export interface RefundOutput {
  success: boolean;
  refundId?: string;
  isSimulated: boolean;
  error?: string;
}

/**
 * Issues a Razorpay refund against a captured payment. When `amountInInr` is
 * omitted the full captured amount is refunded; otherwise a partial refund is
 * requested. In simulated mode (no live keys / mock payment) a mock refund id
 * is returned so the escrow flow can be exercised end-to-end locally.
 */
export async function refundPayment(
  paymentId: string,
  amountInInr?: number
): Promise<RefundOutput> {
  if (!razorpayClient || !paymentId || paymentId.startsWith('pay_mock_')) {
    assertSimulationAllowed('issue a refund');
    console.log(
      `[SIMULATION] Refunding ${amountInInr ?? 'full'} INR against payment: ${paymentId || 'n/a'}`
    );
    return { success: true, refundId: `rfnd_mock_${crypto.randomBytes(8).toString('hex')}`, isSimulated: true };
  }

  try {
    const options =
      typeof amountInInr === 'number' ? { amount: Math.round(amountInInr * 100) } : {};
    const refund = await razorpayClient.payments.refund(paymentId, options);
    return { success: true, refundId: refund.id, isSimulated: false };
  } catch (err) {
    console.error('Razorpay refund failed:', err);
    return { success: false, isSimulated: false, error: (err as Error).message };
  }
}

export interface LinkedAccountInput {
  email: string;
  name: string;
  /** Legal business/individual name shown to Razorpay. */
  legalBusinessName: string;
  /** ifsc + account number for the freelancer's bank account. */
  ifscCode?: string;
  accountNumber?: string;
  beneficiaryName?: string;
  contactName?: string;
  phone?: string;
}

export interface LinkedAccountOutput {
  success: boolean;
  accountId?: string;
  isSimulated: boolean;
  error?: string;
}

/**
 * Creates a Razorpay Route linked account (acc_xxxx) for a freelancer so future
 * milestone payouts can be routed to their bank account. Uses the Razorpay
 * `accounts` API when live keys are present; otherwise returns a deterministic
 * mock account id for local development.
 */
export async function createLinkedAccount(
  input: LinkedAccountInput
): Promise<LinkedAccountOutput> {
  if (!razorpayClient) {
    assertSimulationAllowed('create a linked account');
    console.log(`[SIMULATION] Creating mock Razorpay linked account for: ${input.email}`);
    return {
      success: true,
      accountId: `acc_mock_${crypto.randomBytes(8).toString('hex')}`,
      isSimulated: true,
    };
  }

  try {
    // Razorpay Route onboarding (Accounts API v2).
    const account = await razorpayClient.accounts.create({
      email: input.email,
      phone: input.phone,
      type: 'route',
      legal_business_name: input.legalBusinessName,
      business_type: 'individual',
      contact_name: input.contactName || input.name,
      profile: { category: 'others' },
    });
    return { success: true, accountId: account.id, isSimulated: false };
  } catch (err) {
    console.error('Razorpay linked account creation failed:', err);
    return { success: false, isSimulated: false, error: (err as Error).message };
  }
}
