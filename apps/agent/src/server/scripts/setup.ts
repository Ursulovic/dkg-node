import { configDatabase, createUser } from "../helpers.js";

(async () => {
  const db = configDatabase();

  const seedUsers: Array<{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }> = [];

  for (let i = 1; i <= 10; i++) {
    const email = process.env[`SEED_USER_${i}_EMAIL`];
    const password = process.env[`SEED_USER_${i}_PASSWORD`];

    if (email && password) {
      seedUsers.push({
        email,
        password,
        firstName: process.env[`SEED_USER_${i}_FIRST_NAME`] || "",
        lastName: process.env[`SEED_USER_${i}_LAST_NAME`] || "",
      });
    }
  }

  if (seedUsers.length === 0) {
    console.error("ERROR: No SEED_USER_* environment variables found!");
    console.error("Cannot create users. Deployment will fail without user accounts.");
    process.exit(1);
  }

  for (const user of seedUsers) {
    try {
      console.log(`Creating user: ${user.email}`);
      await createUser(
        db,
        { email: user.email, password: user.password },
        ["mcp", "llm", "blob", "scope123"],
        { firstName: user.firstName, lastName: user.lastName }
      );
      console.log(`✓ Created ${user.email}`);
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes("UNIQUE constraint")) {
        console.log(`⊘ User ${user.email} already exists`);
      } else {
        console.error(`✗ Failed to create ${user.email}:`, error);
      }
    }
  }

  console.log(`Seeding complete. ${seedUsers.length} user(s) processed.`);
})();
