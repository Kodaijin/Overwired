import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth/password";
import { emailSchema, passwordSchema } from "../src/lib/schemas";
import { seedDefaultTaxonomy } from "../src/lib/taxonomy";

/**
 * Creates an account, or resets an existing account's password.
 *
 *   npm run create-user
 *   npm run create-user -- --email me@example.com --name Me
 *
 * The first account can also be created from the registration page, which is
 * always open while the database has no users. This script exists for adding
 * further accounts and for recovering from a forgotten password without
 * opening registration to the network.
 *
 * Run it on the host against the same DATABASE_URL the app uses; the Compose
 * database is published on 127.0.0.1 for exactly this.
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const rawEmail = args.email ?? (await rl.question("Email: "));
    const email = emailSchema.safeParse(rawEmail);
    if (!email.success) {
      fail(email.error.issues[0]?.message ?? "Invalid email address");
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.data },
      select: { id: true },
    });

    if (existing) {
      const answer = await rl.question(
        `An account for ${email.data} already exists. Reset its password? [y/N] `,
      );
      if (answer.trim().toLowerCase() !== "y") {
        console.log("Nothing changed.");
        return;
      }
    }

    const rawPassword = args.password ?? (await rl.question("Password: "));
    const password = passwordSchema.safeParse(rawPassword);
    if (!password.success) {
      fail(password.error.issues[0]?.message ?? "Invalid password");
    }

    const passwordHash = await hashPassword(password.data);

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash },
      });
      console.log(`Password reset for ${email.data}.`);
      console.log(
        "Existing sessions stay valid. To end them all, rotate AUTH_SECRET and restart the app.",
      );
      return;
    }

    const name = args.name ?? (await rl.question("Name (optional): "));

    // The account and its starting taxonomy are created together, so a new
    // user is never left with nothing to pick from.
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: email.data,
          passwordHash,
          name: name.trim() === "" ? null : name.trim(),
        },
        select: { id: true, email: true },
      });
      await seedDefaultTaxonomy(tx, created.id);
      return created;
    });

    console.log(`Created account ${user.email}.`);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

function parseArgs(argv: readonly string[]): {
  email?: string;
  password?: string;
  name?: string;
} {
  const args: { email?: string; password?: string; name?: string } = {};

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value) continue;

    if (flag === "--email") args.email = value;
    if (flag === "--name") args.name = value;
    // Passing a password as an argument puts it in your shell history; the
    // prompt is the better path, and this exists only for automation.
    if (flag === "--password") args.password = value;
  }

  return args;
}

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

main().catch((error) => {
  console.error("Failed to create the account.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
