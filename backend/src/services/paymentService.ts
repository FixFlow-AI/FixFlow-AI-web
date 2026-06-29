import Razorpay from 'razorpay';
import crypto from 'crypto';

const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

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
    console.log('[SIMULATION] Webhook secret not configured. Bypassing signature check.');
    return true;
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
