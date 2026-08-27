export function databaseUrl() {
  return process.env.DATABASE_URL || "file:./clinic.db";
}

export function isPostgresUrl(url = databaseUrl()) {
  return /^(postgres(ql)?|prisma\+postgres):/i.test(url);
}
