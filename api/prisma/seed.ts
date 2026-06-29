import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// ─── Data ─────────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'admin@ecomm.dev';
const ADMIN_PASS  = 'Admin1234!';

const CUSTOMER_EMAIL = 'customer@ecomm.dev';
const CUSTOMER_PASS  = 'Customer1234!';

const CATEGORIES = [
  { name: 'Electronics',    slug: 'electronics'    },
  { name: 'Clothing',       slug: 'clothing'       },
  { name: 'Books',          slug: 'books'          },
  { name: 'Home & Garden',  slug: 'home-garden'    },
];

// priceCents = price in whole cents (e.g. 2999 = $29.99)
const PRODUCTS = [
  // Electronics
  { name: 'Wireless Headphones',    description: 'Over-ear noise-cancelling Bluetooth headphones.',      priceCents:  9999, imageUrl: 'https://placehold.co/400x400?text=Headphones',      stock: 25, categorySlug: 'electronics' },
  { name: 'USB-C Hub 7-in-1',       description: 'Multiport hub with HDMI, USB-A, SD card slot.',       priceCents:  3499, imageUrl: 'https://placehold.co/400x400?text=USB-Hub',          stock: 40, categorySlug: 'electronics' },
  { name: 'Mechanical Keyboard',    description: 'TKL keyboard with Cherry MX Brown switches.',          priceCents:  7999, imageUrl: 'https://placehold.co/400x400?text=Keyboard',         stock: 15, categorySlug: 'electronics' },
  { name: 'Webcam 1080p',           description: 'HD webcam with built-in microphone and autofocus.',    priceCents:  5499, imageUrl: 'https://placehold.co/400x400?text=Webcam',           stock: 20, categorySlug: 'electronics' },
  { name: 'LED Desk Lamp',          description: 'Dimmable touch lamp with USB charging port.',          priceCents:  2999, imageUrl: 'https://placehold.co/400x400?text=Desk+Lamp',        stock: 35, categorySlug: 'electronics' },
  // Clothing
  { name: 'Classic Crew-Neck Tee',  description: '100% organic cotton unisex T-shirt.',                 priceCents:  1999, imageUrl: 'https://placehold.co/400x400?text=T-Shirt',          stock: 80, categorySlug: 'clothing' },
  { name: 'Slim-Fit Chinos',        description: 'Stretch-blend chinos in mid-grey.',                    priceCents:  4999, imageUrl: 'https://placehold.co/400x400?text=Chinos',           stock: 45, categorySlug: 'clothing' },
  { name: 'Hooded Sweatshirt',      description: 'Midweight fleece hoodie with kangaroo pocket.',        priceCents:  5999, imageUrl: 'https://placehold.co/400x400?text=Hoodie',           stock: 60, categorySlug: 'clothing' },
  { name: 'Running Jacket',         description: 'Lightweight water-resistant jacket with reflectors.',  priceCents:  8499, imageUrl: 'https://placehold.co/400x400?text=Jacket',           stock: 30, categorySlug: 'clothing' },
  { name: 'Wool Beanie',            description: 'Ribbed-knit merino wool beanie, one size.',            priceCents:  1499, imageUrl: 'https://placehold.co/400x400?text=Beanie',           stock: 100, categorySlug: 'clothing' },
  // Books
  { name: 'Clean Code',             description: 'A handbook of agile software craftsmanship — Robert C. Martin.', priceCents: 3299, imageUrl: 'https://placehold.co/400x400?text=Clean+Code',       stock: 20, categorySlug: 'books' },
  { name: 'The Pragmatic Programmer',description: '20th Anniversary Edition — Thomas & Hunt.',            priceCents: 3799, imageUrl: 'https://placehold.co/400x400?text=Pragmatic+Prog',    stock: 18, categorySlug: 'books' },
  { name: 'Designing Data-Intensive Applications', description: 'Martin Kleppmann. O\'Reilly, 2017.',   priceCents: 4999, imageUrl: 'https://placehold.co/400x400?text=DDIA',              stock: 12, categorySlug: 'books' },
  { name: 'Atomic Habits',          description: 'James Clear. Build good habits, break bad ones.',       priceCents: 1799, imageUrl: 'https://placehold.co/400x400?text=Atomic+Habits',     stock: 30, categorySlug: 'books' },
  { name: 'Zero to One',            description: 'Peter Thiel on startups and the future.',               priceCents: 1599, imageUrl: 'https://placehold.co/400x400?text=Zero+to+One',       stock: 25, categorySlug: 'books' },
  // Home & Garden
  { name: 'Ceramic Plant Pot Set',  description: 'Set of 3 matte ceramic pots with drainage holes.',     priceCents: 2799, imageUrl: 'https://placehold.co/400x400?text=Plant+Pots',        stock: 50, categorySlug: 'home-garden' },
  { name: 'Bamboo Cutting Board',   description: 'Extra-large end-grain bamboo chopping board.',          priceCents: 3499, imageUrl: 'https://placehold.co/400x400?text=Cutting+Board',     stock: 40, categorySlug: 'home-garden' },
  { name: 'Aromatherapy Candle Set',description: 'Set of 4 soy wax candles — lavender, vanilla, cedar, citrus.', priceCents: 2499, imageUrl: 'https://placehold.co/400x400?text=Candles', stock: 60, categorySlug: 'home-garden' },
  { name: 'Stainless Steel Water Bottle', description: '1L insulated bottle, keeps cold 24h / hot 12h.', priceCents: 3299, imageUrl: 'https://placehold.co/400x400?text=Water+Bottle',     stock: 55, categorySlug: 'home-garden' },
  { name: 'Garden Trowel & Fork Set', description: 'Ergonomic stainless steel hand tools with grip handles.', priceCents: 1999, imageUrl: 'https://placehold.co/400x400?text=Garden+Tools', stock: 35, categorySlug: 'home-garden' },
];

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding database...\n');

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

  console.log(`Users created: admin (id=${admin.id}), customer (id=${customer.id})`);

  // Categories
  const categoryMap: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    const c = await prisma.category.upsert({
      where:  { slug: cat.slug },
      update: {},
      create: cat,
    });
    categoryMap[cat.slug] = c.id;
  }
  console.log(`Categories created: ${Object.keys(categoryMap).join(', ')}`);

  // Products
  let productCount = 0;
  for (const p of PRODUCTS) {
    const { categorySlug, ...data } = p;
    await prisma.product.upsert({
      where:  { id: productCount + 1 },
      update: { ...data, categoryId: categoryMap[categorySlug] },
      create: { ...data, categoryId: categoryMap[categorySlug] },
    });
    productCount++;
  }
  console.log(`Products seeded: ${productCount}`);

  console.log('\n─────────────────────────────────────');
  console.log('Seeded credentials');
  console.log('─────────────────────────────────────');
  console.log(`Admin    │ ${ADMIN_EMAIL} │ ${ADMIN_PASS}`);
  console.log(`Customer │ ${CUSTOMER_EMAIL} │ ${CUSTOMER_PASS}`);
  console.log('─────────────────────────────────────\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
