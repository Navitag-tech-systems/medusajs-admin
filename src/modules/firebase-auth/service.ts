import {
  AbstractAuthModuleProvider,
  MedusaError,
} from "@medusajs/framework/utils"
import type {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityProviderService,
} from "@medusajs/framework/types"
import * as admin from "firebase-admin"

type Options = {
  credentialJsonPath: string
}

class FirebaseAuthService extends AbstractAuthModuleProvider {
  static identifier = "firebase"
  static DISPLAY_NAME = "Firebase Auth"

  private firebaseApp_: admin.app.App
  private options_: Options

  constructor(container: Record<string, unknown>, options: Options) {
    // @ts-ignore - Medusa provider constructor pattern
    super(container, options)

    this.options_ = options

    if (!admin.apps.length) {
      this.firebaseApp_ = admin.initializeApp({
        credential: admin.credential.cert(options.credentialJsonPath),
      })
    } else {
      this.firebaseApp_ = admin.apps[0]!
    }
  }

  static validateOptions(options: Record<string, unknown>) {
    if (!options.credentialJsonPath) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Firebase credentialJsonPath is required"
      )
    }
  }

  async authenticate(
    data: AuthenticationInput,
    authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const idToken = data.body?.id_token as string

    if (!idToken) {
      return { success: false, error: "id_token is required in the request body" }
    }

    try {
      const decoded = await this.firebaseApp_.auth().verifyIdToken(idToken)
      const { uid, email, name } = decoded

      if (!uid) {
        return { success: false, error: "Invalid Firebase token: missing uid" }
      }

      let authIdentity

      try {
        authIdentity = await authIdentityProviderService.retrieve({
          entity_id: uid,
        })
      } catch (error: any) {
        if (error.type === "not_found") {
          authIdentity = await authIdentityProviderService.create({
            entity_id: uid,
            user_metadata: {
              email: email || null,
              name: name || null,
              firebase_uid: uid,
            },
          })
        } else {
          throw error
        }
      }

      return { success: true, authIdentity }
    } catch (error: any) {
      if (error.authIdentity) {
        return { success: true, authIdentity: error.authIdentity }
      }
      return {
        success: false,
        error: error.message || "Firebase authentication failed",
      }
    }
  }

  async register(
    _data: AuthenticationInput,
    _authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    return {
      success: false,
      error: "Registration is handled through Firebase client SDK. Use authenticate instead.",
    }
  }

  async update(
    _data: Record<string, unknown>,
    _authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    return { success: false, error: "Update not supported for Firebase auth" }
  }

  async validateCallback(
    _data: AuthenticationInput,
    _authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    return { success: false, error: "Callback not supported for Firebase auth" }
  }
}

export default FirebaseAuthService
