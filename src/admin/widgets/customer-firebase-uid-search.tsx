import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Input, Text, toast } from "@medusajs/ui"
import { Link } from "react-router-dom"
import { useState } from "react"
import { sdk } from "../lib/sdk"

type CustomerMatch = {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  metadata?: Record<string, unknown> | null
}

type LookupResponse = {
  customers: CustomerMatch[]
  count: number
}

const CustomerFirebaseUidSearchWidget = () => {
  const [uid, setUid] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<CustomerMatch[] | null>(null)
  const [searchedUid, setSearchedUid] = useState("")
  const [error, setError] = useState<string | null>(null)

  const trimmed = uid.trim()
  const canSubmit = trimmed.length > 0 && !loading

  const handleSearch = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    setResults(null)
    setSearchedUid(trimmed)
    try {
      const data = await sdk.client.fetch<LookupResponse>(
        "/admin/customers/by-firebase-uid",
        { query: { uid: trimmed } }
      )
      setResults(data.customers ?? [])
    } catch (e: any) {
      const message =
        e?.message || "Failed to look up customer by Firebase UID"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSearch()
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Find by Firebase UID</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Look up a customer by the Firebase UID stored in their metadata.
        </Text>
      </div>
      <div className="flex items-center gap-x-2 px-6 py-4">
        <Input
          placeholder="Firebase UID"
          value={uid}
          onChange={(e) => setUid(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <Button
          variant="primary"
          onClick={handleSearch}
          disabled={!canSubmit}
          isLoading={loading}
        >
          Search
        </Button>
      </div>
      {(error || results !== null) && (
        <div className="px-6 py-4">
          {error && (
            <Text size="small" className="text-ui-fg-error">
              {error}
            </Text>
          )}
          {!error && results && results.length === 0 && (
            <Text size="small" className="text-ui-fg-subtle">
              No customer found with that UID.
            </Text>
          )}
          {!error && results && results.length > 0 && (
            <ul className="flex flex-col gap-y-2">
              {results.map((c) => {
                const name = [c.first_name, c.last_name]
                  .filter(Boolean)
                  .join(" ")
                  .trim()
                return (
                  <li key={c.id}>
                    <Link
                      to={`/customers/${c.id}`}
                      className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover flex flex-col"
                    >
                      <Text size="small" weight="plus">
                        {c.email}
                      </Text>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        {name ? `${name} · ` : ""}UID: {truncate(searchedUid)}
                      </Text>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </Container>
  )
}

const truncate = (value: string, head = 6, tail = 4) => {
  if (value.length <= head + tail + 1) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}

export const config = defineWidgetConfig({
  zone: "customer.list.before",
})

export default CustomerFirebaseUidSearchWidget
