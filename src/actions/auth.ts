"use server";

import { getDictionary } from "@/i18n/get-dictionary";
import { createRegisterActionSchema } from "@/i18n/schemas";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export type RegisterErrorCode =
  | "invalidFields"
  | "emailTaken"
  | "somethingWentWrong";

export async function registerUser(values: z.infer<ReturnType<typeof createRegisterActionSchema>>) {
  const { messages } = await getDictionary();
  const RegisterSchema = createRegisterActionSchema(messages);
  const validatedFields = RegisterSchema.safeParse(values);

  if (!validatedFields.success) {
    return { error: "invalidFields" as RegisterErrorCode };
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

    return { success: true as const };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { error: "emailTaken" as RegisterErrorCode };
      }
    }
    return { error: "somethingWentWrong" as RegisterErrorCode };
  }
}
