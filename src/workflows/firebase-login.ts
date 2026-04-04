import {
  createWorkflow,
  createStep,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import type { AuthIdentityDTO, CustomerDTO } from "@medusajs/framework/types"

type FirebaseLoginInput = {
  id_token: string
}

const authenticateFirebaseStep = createStep(
  "authenticate-firebase",
  async (input: FirebaseLoginInput, { container }) => {
    const authModuleService = container.resolve(Modules.AUTH)

    const authResult = await authModuleService.authenticate("firebase", {
      body: { id_token: input.id_token },
    } as any)

    if (!authResult.success) {
      throw new Error(authResult.error || "Firebase authentication failed")
    }

    const authIdentity = authResult.authIdentity as AuthIdentityDTO

    // Extract user_metadata from provider_identities
    let email: string | null = null
    let name: string | null = null

    if (authIdentity.provider_identities?.length) {
      const providerIdentity = authIdentity.provider_identities[0]
      const metadata = providerIdentity.user_metadata as Record<string, any> || {}
      email = metadata.email || null
      name = metadata.name || null
    }

    return new StepResponse({
      authIdentityId: authIdentity.id,
      email,
      name,
    })
  }
)

const findOrCreateCustomerStep = createStep(
  "find-or-create-firebase-customer",
  async (
    input: { authIdentityId: string; email: string | null; name: string | null },
    { container }
  ) => {
    const customerModuleService = container.resolve(Modules.CUSTOMER)
    const authModuleService = container.resolve(Modules.AUTH)

    // Check if a customer is already linked to this auth identity
    const [authIdentity] = await authModuleService.listAuthIdentities({
      id: [input.authIdentityId],
    })

    const existingCustomerId = (authIdentity?.app_metadata as Record<string, any>)?.customer_id as string | undefined
    if (existingCustomerId) {
      const existingCustomers = await customerModuleService.listCustomers({
        id: [existingCustomerId],
      })
      if (existingCustomers.length > 0) {
        return new StepResponse(existingCustomers[0] as CustomerDTO)
      }
    }

    // Check if a customer with this email already exists
    if (input.email) {
      const existingByEmail = await customerModuleService.listCustomers({
        email: [input.email],
      })
      if (existingByEmail.length > 0) {
        // Link existing customer to this auth identity
        const customer = existingByEmail[0] as CustomerDTO
        await authModuleService.updateAuthIdentities([{
          id: input.authIdentityId,
          app_metadata: {
            customer_id: customer.id,
          },
        }])
        return new StepResponse(customer)
      }
    }

    // No existing customer — create one
    const { result: customer } = await createCustomerAccountWorkflow(container).run({
      input: {
        authIdentityId: input.authIdentityId,
        customerData: {
          email: input.email || `firebase-${input.authIdentityId}@placeholder.local`,
          first_name: input.name || "User",
          last_name: "",
        },
      },
    })

    return new StepResponse(customer as CustomerDTO)
  }
)

const generateTokenStep = createStep(
  "generate-medusa-token",
  async (
    input: { authIdentityId: string; customerId: string },
    { container }
  ) => {
    const configModule = container.resolve("configModule") as any
    const jwtSecret = configModule.projectConfig.http.jwtSecret

    const jwt = await import("jsonwebtoken")

    const token = jwt.default.sign(
      {
        actor_id: input.customerId,
        actor_type: "customer",
        auth_identity_id: input.authIdentityId,
      },
      jwtSecret,
      { expiresIn: "24h" }
    )

    return new StepResponse(token)
  }
)

export const firebaseLoginWorkflow = createWorkflow(
  "firebase-login",
  (input: FirebaseLoginInput) => {
    const authData = authenticateFirebaseStep(input)

    const customer = findOrCreateCustomerStep({
      authIdentityId: authData.authIdentityId,
      email: authData.email,
      name: authData.name,
    })

    const token = generateTokenStep({
      authIdentityId: authData.authIdentityId,
      customerId: customer.id,
    })

    return new WorkflowResponse(token)
  }
)
