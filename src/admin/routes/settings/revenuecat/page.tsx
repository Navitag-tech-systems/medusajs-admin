import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Table, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { sdk } from "../../../lib/sdk"

type Row = {
  sku: string
  store_id: string
  product: string | null
  currency: string
  web_price: number | null
  markup: number
  iap_target: number | null
}

type Preview = { currency: string; markup: number; rows: Row[] }

const money = (n: number | null, currency: string) => {
  if (n == null) return "—"
  try {
    return new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(n)
  } catch {
    return `${n} ${currency}`
  }
}

const RevenueCatIapPage = () => {
  const [data, setData] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await sdk.client.fetch<Preview>("/admin/revenuecat/sync-prices")
      setData(res)
    } catch (e: any) {
      const m = e?.message || "Failed to load IAP prices"
      setError(m)
      toast.error(m)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const sync = async () => {
    setSyncing(true)
    try {
      const res = await sdk.client.fetch<{ status: string; message: string }>(
        "/admin/revenuecat/sync-prices",
        { method: "POST" }
      )
      if (res.status === "deferred") {
        toast.info(res.message)
      } else {
        toast.success("Prices synced to the App Store.")
      }
    } catch (e: any) {
      toast.error(e?.message || "Sync failed")
    } finally {
      setSyncing(false)
    }
  }

  const markup = data?.markup ?? 1.2

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">App Store IAP Pricing</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            Medusa is the source of truth. IAP target = web price &times; {markup} (rounded).
          </Text>
        </div>
        <Button variant="primary" onClick={sync} isLoading={syncing} disabled={loading || !!error}>
          Sync to App Store
        </Button>
      </div>

      {error ? (
        <div className="px-6 py-4">
          <Text className="text-ui-fg-error" size="small">
            {error}
          </Text>
        </div>
      ) : (
        <div className="px-6 py-4">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Plan</Table.HeaderCell>
                <Table.HeaderCell>App Store product ID</Table.HeaderCell>
                <Table.HeaderCell>Web price</Table.HeaderCell>
                <Table.HeaderCell>IAP target (&times;{markup})</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {(data?.rows || []).map((r) => (
                <Table.Row key={r.sku}>
                  <Table.Cell>
                    <Badge size="2xsmall">{r.sku}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="font-mono text-ui-fg-subtle">
                      {r.store_id}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>{money(r.web_price, r.currency)}</Table.Cell>
                  <Table.Cell className="font-medium">{money(r.iap_target, r.currency)}</Table.Cell>
                </Table.Row>
              ))}
              {loading && (
                <Table.Row>
                  <Table.Cell colSpan={4}>
                    <Text size="small" className="text-ui-fg-muted">
                      Loading…
                    </Text>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
          <Text className="text-ui-fg-muted mt-4" size="xsmall">
            Auto-push via the App Store Connect API isn&rsquo;t wired yet — set these price points in App
            Store Connect for now. &ldquo;Sync to App Store&rdquo; will complete the push once the Paid Apps
            agreement is active and the IAPs exist in App Store Connect.
          </Text>
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "App Store IAP",
})

export default RevenueCatIapPage
