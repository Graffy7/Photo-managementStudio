import { Platform } from "react-native";
import type { Checkout } from "../types/billing";

const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

export type CheckoutOutcome =
  | { kind: "paid"; orderId: string; paymentId: string; signature: string }
  | { kind: "failed"; orderId: string; reason: string }
  | { kind: "dismissed"; orderId: string };

let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = SCRIPT_URL;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => { loading = null; reject(new Error("Couldn't load the payment window. Check your internet connection and try again.")); };
    document.body.appendChild(el);
  });
  return loading;
}

// Opens Razorpay's own checkout (UPI, cards, net banking, wallets). Card numbers, CVVs and UPI PINs
// are typed into Razorpay's window only - they never pass through this app or its server. The
// result is only a claim until the server has verified it.
// onAttemptFailed: a try failed (the window stays open so the customer can retry another way).
export async function openRazorpayCheckout(
  checkout: Checkout,
  onAttemptFailed?: (reason: string) => void,
  theme = "#ff9a4d",
): Promise<CheckoutOutcome> {
  if (Platform.OS !== "web") {
    throw new Error("Online payment is available in the web app.");
  }
  await loadScript();

  return new Promise<CheckoutOutcome>((resolve) => {
    let settled = false;
    let lastFailure: string | null = null;
    const done = (o: CheckoutOutcome) => { if (!settled) { settled = true; resolve(o); } };

    const rzp = new (window as any).Razorpay({
      key: checkout.keyId,
      order_id: checkout.orderId,
      amount: checkout.amount,
      currency: checkout.currency,
      name: "Studio OS",
      description: `${checkout.planName} subscription — ${checkout.studioName}`,
      prefill: { email: checkout.email ?? undefined, contact: checkout.phone ?? undefined },
      theme: { color: theme },
      // UPI first (QR code, UPI ID, GPay/PhonePe/Paytm), then Razorpay's usual methods - cards,
      // net banking, wallets - underneath.
      config: {
        display: {
          blocks: {
            upi: { name: "Pay by UPI", instruments: [{ method: "upi" }] },
          },
          sequence: ["block.upi"],
          preferences: { show_default_blocks: true },
        },
      },
      handler: (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) =>
        done({ kind: "paid", orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
      modal: {
        ondismiss: () => done(lastFailure
          ? { kind: "failed", orderId: checkout.orderId, reason: lastFailure }
          : { kind: "dismissed", orderId: checkout.orderId }),
      },
    });
    rzp.on("payment.failed", (r: { error?: { description?: string } }) => {
      lastFailure = r.error?.description ?? "The payment didn't go through.";
      onAttemptFailed?.(lastFailure);
    });
    rzp.open();
  });
}
