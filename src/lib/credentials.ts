import bcrypt from "bcryptjs";

import prisma from "./prisma";

export async function authenticateWithPassword(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.hashedPassword) {
    return null;
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.hashedPassword);
  if (!isPasswordCorrect) {
    return null;
  }

  return user;
}
