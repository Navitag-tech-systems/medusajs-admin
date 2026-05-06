import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Container, Heading, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { sdk } from "../lib/sdk"

type Payment = {
  id: string
  provider_id: string
  amount?: number | string | null
  currency_code?: string | null
  captured_at?: string | null
  data?: Record<string, unknown> | null
}

type FieldDef = {
  key: string
  label: string
  primary?: boolean
  externalUrl?: (value: string) => string
}

type ProviderConfig = {
  label: string
  fields: FieldDef[]
}

// Registry: add new payment providers here. Each entry maps provider_id (the
// Medusa payment.provider_id) to the fields we want to surface from
// payment.data. Order matters — primary first.
const PROVIDERS: Record<string, ProviderConfig> = {
  pp_paypal_paypal: {
    label: "PayPal",
    fields: [
      {
        key: "capture_id",
        label: "Transaction ID (matches PayPal dashboard)",
        primary: true,
        externalUrl: (v) => `https://www.paypal.com/activity/payment/${v}`,
      },
      { key: "id", label: "PayPal Order ID" },
      { key: "authorization_id", label: "Authorization ID" },
    ],
  },
  // Future:
  // stripe_stripe: { label: "Stripe", fields: [{ key: "id", label: "Charge ID", primary: true, externalUrl: (v) => `https://dashboard.stripe.com/payments/${v}` }] },
}

const getNested = (obj: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>(
    (acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined),
    obj,
  )

const copy = (value: string) => {
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success("Copied"))
    .catch(() => toast.error("Copy failed"))
}

const FieldRow = ({
  label,
  value,
  primary,
  externalUrl,
}: {
  label: string
  value: string
  primary?: boolean
  externalUrl?: string
}) => (
  <div className="flex flex-col gap-y-0.5">
    <Text size="xsmall" className="text-ui-fg-subtle">
      {label}
    </Text>
    <div className="flex items-center gap-x-2 flex-wrap">
      <Text
        size={primary ? "small" : "xsmall"}
        weight={primary ? "plus" : "regular"}
        className="font-mono break-all"
      >
        {value}
      </Text>
      <button
        type="button"
        onClick={() => copy(value)}
        className="text-ui-fg-subtle hover:text-ui-fg-base text-xs underline"
        title="Copy to clipboard"
      >
        Copy
      </button>
      {externalUrl && (
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover text-xs underline"
        >
          Open ↗
        </a>
      )}
    </div>
  </div>
)

const ProviderFields = ({ payment }: { payment: Payment }) => {
  const cfg = PROVIDERS[payment.provider_id]
  if (cfg) {
    const rows = cfg.fields
      .map((f) => {
        const raw = getNested(payment.data, f.key)
        if (raw == null || raw === "") return null
        const value = String(raw)
        return (
          <FieldRow
            key={f.key}
            label={f.label}
            value={value}
            primary={f.primary}
            externalUrl={f.externalUrl?.(value)}
          />
        )
      })
      .filter(Boolean)

    if (rows.length === 0) {
      return (
        <Text size="xsmall" className="text-ui-fg-subtle">
          No transaction data captured yet.
        </Text>
      )
    }
    return <div className="flex flex-col gap-y-2">{rows}</div>
  }

  // Generic fallback: surface any string/number scalar from payment.data so a
  // newly-added provider is at least debuggable without a code change here.
  const entries = Object.entries(payment.data ?? {}).filter(
    ([, v]) => typeof v === "string" || typeof v === "number",
  )
  if (entries.length === 0) {
    return (
      <Text size="xsmall" className="text-ui-fg-subtle">
        No provider transaction data persisted.
      </Text>
    )
  }
  return (
    <div className="flex flex-col gap-y-2">
      {entries.map(([k, v]) => (
        <FieldRow key={k} label={k} value={String(v)} />
      ))}
    </div>
  )
}

const collectPayments = (order: unknown): Payment[] => {
  const o = order as { payment_collections?: Array<{ payments?: Payment[] }> } | undefined
  const out: Payment[] = []
  for (const pc of o?.payment_collections ?? []) {
    for (const p of pc?.payments ?? []) out.push(p)
  }
  return out
}

const PaymentProviderDetailsWidget = ({
  data: order,
}: {
  data: { id: string }
}) => {
  const [payments, setPayments] = useState<Payment[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!order?.id) return
    let cancelled = false
    sdk.client
      .fetch<{ order: unknown }>(`/admin/orders/${order.id}`, {
        query: {
          fields: [
            "+payment_collections.payments.id",
            "+payment_collections.payments.provider_id",
            "+payment_collections.payments.amount",
            "+payment_collections.payments.currency_code",
            "+payment_collections.payments.captured_at",
            "+payment_collections.payments.data",
          ].join(","),
        },
      })
      .then((res) => {
        if (cancelled) return
        setPayments(collectPayments(res?.order))
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : "Failed to load payments"
        setError(msg)
      })
    return () => {
      cancelled = true
    }
  }, [order?.id])

  if (error) {
    return (
      <Container className="p-6">
        <Heading level="h2">Payment Provider</Heading>
        <Text size="small" className="text-ui-fg-error">
          {error}
        </Text>
      </Container>
    )
  }
  if (!payments || payments.length === 0) return null

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Payment Provider</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          External IDs for cross-referencing with the provider's dashboard.
        </Text>
      </div>
      <div className="flex flex-col gap-y-4 px-6 py-4">
        {payments.map((p) => (
          <div key={p.id} className="flex flex-col gap-y-2">
            <div>
              <Badge size="2xsmall">
                {PROVIDERS[p.provider_id]?.label ?? p.provider_id}
              </Badge>
            </div>
            <ProviderFields payment={p} />
          </div>
        ))}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
})

export default PaymentProviderDetailsWidget
