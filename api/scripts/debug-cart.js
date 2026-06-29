require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const CART_INCLUDE = {
  items: {
    include: {
      product: {
        include: { category: { select: { id: true, name: true, slug: true } } },
      },
    },
  },
};

async function main() {
  console.log('Testing findUnique with CART_INCLUDE...');
  const result = await prisma.cart.findUnique({
    where: { userId: 5 },
    include: CART_INCLUDE,
  });
  console.log('Result:', JSON.stringify(result));
}

main()
  .catch(e => {
    console.error('FULL ERROR:', e.constructor.name);
    console.error('MESSAGE:', e.message);
    console.error('CODE:', e.code);
    process.exit(1);
  })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
