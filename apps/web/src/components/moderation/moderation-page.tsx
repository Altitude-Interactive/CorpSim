"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InlineHelp } from "@/components/ui/inline-help";
import { useToast } from "@/components/ui/toast-manager";
import { cancelModerationOrder, issueModerationRefund } from "@/lib/api";

function isPositiveInteger(value: string): boolean {
  return /^[0-9]+$/.test(value) && BigInt(value) > 0n;
}

export function ModerationPage() {
  const { showToast } = useToast();
  const [refundUserId, setRefundUserId] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [isRefunding, setRefunding] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [isCancelling, setCancelling] = useState(false);

  const handleRefundSubmit = useCallback(async () => {
    const trimmedUserId = refundUserId.trim();
    const trimmedAmount = refundAmount.trim();
    const trimmedReason = refundReason.trim();

    if (!trimmedUserId) {
      showToast({
        title: "Missing user",
        description: "Enter the target user ID before issuing a refund.",
        variant: "warning"
      });
      return;
    }

    if (!isPositiveInteger(trimmedAmount)) {
      showToast({
        title: "Invalid amount",
        description: "Refund amount must be a positive integer in cents.",
        variant: "warning"
      });
      return;
    }

    if (!trimmedReason) {
      showToast({
        title: "Missing reason",
        description: "Provide a short reason for the refund.",
        variant: "warning"
      });
      return;
    }

    if (trimmedReason.length > 140) {
      showToast({
        title: "Reason too long",
        description: "Limit the refund reason to 140 characters.",
        variant: "warning"
      });
      return;
    }

    setRefunding(true);
    try {
      const result = await issueModerationRefund({
        targetUserId: trimmedUserId,
        amountCents: trimmedAmount,
        reason: trimmedReason
      });

      showToast({
        title: "Refund issued",
        description: `Ledger entry ${result.ledgerEntryId} created. Balance now ${result.balanceAfterCents} cents.`,
        variant: "success"
      });

      setRefundAmount("");
      setRefundReason("");
    } catch (error) {
      showToast({
        title: "Refund failed",
        description: error instanceof Error ? error.message : "Unable to issue refund.",
        variant: "error"
      });
    } finally {
      setRefunding(false);
    }
  }, [refundAmount, refundReason, refundUserId, showToast]);

  const handleCancelOrder = useCallback(async () => {
    const trimmedOrderId = orderId.trim();

    if (!trimmedOrderId) {
      showToast({
        title: "Missing order",
        description: "Enter an order ID to cancel.",
        variant: "warning"
      });
      return;
    }

    setCancelling(true);
    try {
      const order = await cancelModerationOrder(trimmedOrderId);
      showToast({
        title: "Order cancelled",
        description: `Order ${order.id} is now ${order.status.toLowerCase()}.`,
        variant: "success"
      });
      setOrderId("");
    } catch (error) {
      showToast({
        title: "Cancel failed",
        description: error instanceof Error ? error.message : "Unable to cancel order.",
        variant: "error"
      });
    } finally {
      setCancelling(false);
    }
  }, [orderId, showToast]);

  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Moderation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Apply refunds and cancel market orders. Every action writes an audit entry to the ledger.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-sky-500/30 bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-slate-100">Issue Refund</CardTitle>
            <CardDescription className="text-slate-400">
              Credit cash back to a player and log a moderation adjustment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="flex items-center gap-2">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Target user ID
                </label>
                <InlineHelp label="Use the user ID from the admin dashboard." />
              </div>
              <Input
                value={refundUserId}
                onChange={(event) => setRefundUserId(event.target.value)}
                placeholder="user_123"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                Amount (cents)
              </label>
              <Input
                value={refundAmount}
                onChange={(event) => setRefundAmount(event.target.value)}
                placeholder="10000"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Reason</label>
              <Input
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
                placeholder="Order issue correction"
                maxLength={140}
              />
            </div>
            <div className="flex items-center justify-end">
              <Button type="button" onClick={() => void handleRefundSubmit()} disabled={isRefunding}>
                {isRefunding ? "Issuing..." : "Issue refund"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-slate-100">Cancel Market Order</CardTitle>
            <CardDescription className="text-slate-400">
              Release reserved cash or inventory for a problematic order.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Order ID</label>
              <Input
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                placeholder="order_456"
              />
            </div>
            <div className="flex items-center justify-end">
              <Button type="button" onClick={() => void handleCancelOrder()} disabled={isCancelling}>
                {isCancelling ? "Cancelling..." : "Cancel order"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
