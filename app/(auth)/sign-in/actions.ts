"use server"

import { signIn } from "@/auth"
import { AuthError } from "next-auth"

export async function login(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return "Please fill in all fields"
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/" })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Invalid email or password"
        default:
          return "Something went wrong, try again"
      }
    }
    throw error
  }
}
