import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { firebaseLoginWorkflow } from "../../../../workflows/firebase-login"

type FirebaseAuthBody = {
  id_token: string
}

export async function POST(
  req: MedusaRequest<FirebaseAuthBody>,
  res: MedusaResponse
) {
  const { id_token } = req.body

  if (!id_token) {
    return res.status(400).json({
      message: "id_token is required in the request body",
    })
  }

  try {
    const { result: token } = await firebaseLoginWorkflow(req.scope).run({
      input: { id_token },
    })

    return res.json({ token })
  } catch (error: any) {
    return res.status(401).json({
      message: error.message || "Firebase authentication failed",
    })
  }
}
