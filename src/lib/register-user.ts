import bcrypt from "bcryptjs";
import { z } from "zod";

import prisma from "./prisma";

const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function registerUser(values: z.infer<typeof RegisterSchema>) {
  const validatedFields = RegisterSchema.safeParse(values);

  if (!validatedFields.success) {
    return { error: "Invalid fields!" };
  }

  const { name, email, password } = validatedFields.data;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          hashedPassword,
        },
      });

      await tx.wallet.create({
        data: {
          userId: newUser.id,
        },
      });
    });

    return { success: "User created successfully! Please log in." };
  } catch (error) {
    // Each generated client has its own error class, so instanceof only
    // matches the provider that threw. Compare the stable Prisma code.
    if (isUniqueConstraintError(error)) {
      return { error: "An account with this email already exists." };
    }
    return { error: "Something went wrong." };
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { name?: unknown; code?: unknown };
  return (
    candidate.name === "PrismaClientKnownRequestError" && candidate.code === "P2002"
  );
}
