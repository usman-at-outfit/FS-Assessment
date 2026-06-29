require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // find any user to test with
  const user = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
  console.log('Testing cart for userId:', user && user.id);

  const cart = await prisma.cart.findUnique({
    where: { userId: user.id },
    include: {
      items: {
        include: {
          product: {
            include: { category: { select: { id: true, name: true, slug: true } } },
          },
        },
      },
    },
  });
  console.log('Cart result:', JSON.stringify(cart, null, 2));
}

main()
  .catch(e => console.error('PRISMA ERROR:', e.message, e.code))
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
