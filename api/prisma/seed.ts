import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// ─── Credentials ──────────────────────────────────────────────────────────────

const ADMIN_EMAIL    = 'admin@sundry.dev';
const ADMIN_PASS     = 'Admin1234!';
const CUSTOMER_EMAIL = 'customer@sundry.dev';
const CUSTOMER_PASS  = 'Customer1234!';

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Kitchen',    slug: 'kitchen'    },
  { name: 'Bath',       slug: 'bath'       },
  { name: 'Body',       slug: 'body'       },
  { name: 'On the Go',  slug: 'on-the-go'  },
];

// ─── Products ─────────────────────────────────────────────────────────────────
// priceCents: price in integer cents (e.g. 2499 = $24.99). Never floats.

const PRODUCTS = [
  // Kitchen
  {
    name: 'Bamboo Cutting Board',
    description: 'Extra-large end-grain bamboo chopping board. Naturally antibacterial, gentle on knife edges.',
    priceCents: 2499, imageUrl: 'https://placehold.co/400x400/d2d0a2/3A3A2C?text=Cutting+Board',
    stock: 40, categorySlug: 'kitchen',
  },
  {
    name: 'Beeswax Food Wraps 3-Pack',
    description: 'Reusable wraps made from organic cotton, beeswax, and plant oils. Replaces single-use cling film.',
    priceCents: 1899, imageUrl: 'https://placehold.co/400x400/cfd0a6/3A3A2C?text=Food+Wraps',
    stock: 60, categorySlug: 'kitchen',
  },
  {
    name: 'Stainless Steel Straw Set',
    description: '8 reusable straws with cleaning brush — straight and bent, in a linen pouch.',
    priceCents: 1299, imageUrl: 'https://placehold.co/400x400/b9bc92/3A3A2C?text=Straws',
    stock: 80, categorySlug: 'kitchen',
  },
  {
    name: 'Silicone Stretch Lids 6-Pack',
    description: 'Stretch over any bowl or tin to seal. BPA-free silicone, dishwasher-safe.',
    priceCents: 1999, imageUrl: 'https://placehold.co/400x400/c8cfb6/3A3A2C?text=Stretch+Lids',
    stock: 55, categorySlug: 'kitchen',
  },
  {
    name: 'Compostable Sponge 3-Pack',
    description: 'Loofah + cellulose sponges. Home-compostable — no plastic microfibers.',
    priceCents: 999, imageUrl: 'https://placehold.co/400x400/a9ad7c/3A3A2C?text=Sponges',
    stock: 90, categorySlug: 'kitchen',
  },
  // Bath
  {
    name: 'Organic Cotton Towel Set',
    description: 'Set of 2 bath towels woven from 100% GOTS-certified organic cotton.',
    priceCents: 4999, imageUrl: 'https://placehold.co/400x400/9fa980/3A3A2C?text=Towels',
    stock: 30, categorySlug: 'bath',
  },
  {
    name: 'Shampoo Bar — Argan',
    description: 'Cold-processed solid shampoo with argan oil. Equivalent to ~3 bottles. Sulphate-free.',
    priceCents: 1499, imageUrl: 'https://placehold.co/400x400/cfd0a6/3A3A2C?text=Shampoo+Bar',
    stock: 70, categorySlug: 'bath',
  },
  {
    name: 'Bamboo Bath Mat',
    description: 'Slatted solid bamboo mat, quick-dry and naturally mould-resistant.',
    priceCents: 3499, imageUrl: 'https://placehold.co/400x400/d2d0a2/3A3A2C?text=Bath+Mat',
    stock: 25, categorySlug: 'bath',
  },
  {
    name: 'Refillable Glass Soap Dispenser',
    description: '350ml amber glass pump bottle. Fits any liquid soap — bring your own refill.',
    priceCents: 2299, imageUrl: 'https://placehold.co/400x400/b9bc92/3A3A2C?text=Dispenser',
    stock: 45, categorySlug: 'bath',
  },
  {
    name: 'Bamboo Soap Dish',
    description: 'Slatted bamboo dish keeps bar soap dry between uses, extending its life.',
    priceCents: 1199, imageUrl: 'https://placehold.co/400x400/c8cfb6/3A3A2C?text=Soap+Dish',
    stock: 65, categorySlug: 'bath',
  },
  // Body
  {
    name: 'Organic Lavender Body Oil',
    description: 'Cold-pressed jojoba and sweet almond oil with lavender essential oil. 100ml.',
    priceCents: 2899, imageUrl: 'https://placehold.co/400x400/a9ad7c/3A3A2C?text=Body+Oil',
    stock: 40, categorySlug: 'body',
  },
  {
    name: 'Solid Conditioner Bar',
    description: 'Concentraded formula with shea butter and coconut oil. Lasts ~80 washes.',
    priceCents: 1699, imageUrl: 'https://placehold.co/400x400/9fa980/3A3A2C?text=Conditioner',
    stock: 55, categorySlug: 'body',
  },
  {
    name: 'Bamboo Toothbrush 4-Pack',
    description: 'FSC-certified bamboo handles with BPA-free nylon bristles. Naturally biodegradable.',
    priceCents: 1399, imageUrl: 'https://placehold.co/400x400/cfd0a6/3A3A2C?text=Toothbrush',
    stock: 100, categorySlug: 'body',
  },
  {
    name: 'Natural Mineral Deodorant',
    description: 'Aluminium-free deodorant stick. Lasts all day — no parabens, no baking soda.',
    priceCents: 1999, imageUrl: 'https://placehold.co/400x400/d2d0a2/3A3A2C?text=Deodorant',
    stock: 50, categorySlug: 'body',
  },
  {
    name: 'Organic Cotton Face Pads 20-Pack',
    description: 'Reusable rounds in a laundry bag. Machine-washable organic cotton.',
    priceCents: 1199, imageUrl: 'https://placehold.co/400x400/b9bc92/3A3A2C?text=Face+Pads',
    stock: 75, categorySlug: 'body',
  },
  // On the Go
  {
    name: 'Insulated Water Bottle 750ml',
    description: 'Double-walled stainless steel. Keeps cold 24h, hot 12h. Leakproof twist cap.',
    priceCents: 3499, imageUrl: 'https://placehold.co/400x400/c8cfb6/3A3A2C?text=Water+Bottle',
    stock: 60, categorySlug: 'on-the-go',
  },
  {
    name: 'Collapsible Coffee Cup',
    description: '350ml silicone cup folds flat — fits in a pocket. Food-grade, BPA-free.',
    priceCents: 2799, imageUrl: 'https://placehold.co/400x400/a9ad7c/3A3A2C?text=Coffee+Cup',
    stock: 45, categorySlug: 'on-the-go',
  },
  {
    name: 'Reusable Produce Bags 5-Pack',
    description: 'Lightweight mesh bags in 3 sizes. Washable organic cotton. Visible tare weight tag.',
    priceCents: 1699, imageUrl: 'https://placehold.co/400x400/9fa980/3A3A2C?text=Produce+Bags',
    stock: 80, categorySlug: 'on-the-go',
  },
  {
    name: 'Bamboo Travel Cutlery Set',
    description: 'Fork, knife, spoon, chopsticks and straw in a roll-up linen case.',
    priceCents: 2199, imageUrl: 'https://placehold.co/400x400/cfd0a6/3A3A2C?text=Cutlery',
    stock: 55, categorySlug: 'on-the-go',
  },
  {
    name: 'Beeswax Lip Balm',
    description: 'Tinted and natural variants. Organic beeswax, coconut oil, vitamin E. Paper tube.',
    priceCents: 899, imageUrl: 'https://placehold.co/400x400/d2d0a2/3A3A2C?text=Lip+Balm',
    stock: 120, categorySlug: 'on-the-go',
  },
];

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding database…\n');

  // Users
  const adminHash    = await argon2.hash(ADMIN_PASS);
  const customerHash = await argon2.hash(CUSTOMER_PASS);

  const admin = await prisma.user.upsert({
    where:  { email: ADMIN_EMAIL },
    update: {},
    create: { email: ADMIN_EMAIL, passwordHash: adminHash, role: 'ADMIN' },
  });

  const customer = await prisma.user.upsert({
    where:  { email: CUSTOMER_EMAIL },
    update: {},
    create: { email: CUSTOMER_EMAIL, passwordHash: customerHash, role: 'CUSTOMER' },
  });

  console.log(`Users:  admin (id=${admin.id}), customer (id=${customer.id})`);

  // Categories
  const catMap: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    const c = await prisma.category.upsert({
      where:  { slug: cat.slug },
      update: {},
      create: cat,
    });
    catMap[cat.slug] = c.id;
  }
  console.log(`Categories: ${Object.keys(catMap).join(', ')}`);

  // Products — only seed if table is empty (idempotent)
  const existing = await prisma.product.count();
  let count = 0;
  if (existing === 0) {
    for (const p of PRODUCTS) {
      const { categorySlug, ...data } = p;
      await prisma.product.create({ data: { ...data, categoryId: catMap[categorySlug] } });
      count++;
    }
    console.log(`Products: ${count} seeded`);
  } else {
    console.log(`Products: skipped (${existing} already exist)`);
  }

  console.log('\n──────────────────────────────────────────');
  console.log('Seeded login credentials');
  console.log('──────────────────────────────────────────');
  console.log(`Admin    │ ${ADMIN_EMAIL}    │ ${ADMIN_PASS}`);
  console.log(`Customer │ ${CUSTOMER_EMAIL} │ ${CUSTOMER_PASS}`);
  console.log('──────────────────────────────────────────\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
