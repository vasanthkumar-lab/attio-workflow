import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 moved the connection URL out of schema.prisma. The CLI reads it here for
 * migrate and introspect; the application connects through a driver adapter instead -
 * see src/prisma/prisma.service.ts.
 *
 * The datasource is only declared when DATABASE_URL is set, so `prisma generate` still
 * works on a machine with no database. `prisma migrate` will tell you it is missing.
 */
const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  ...(url ? { datasource: { url } } : {}),
});
