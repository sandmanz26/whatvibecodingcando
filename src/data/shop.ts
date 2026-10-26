/**
 * Sample catalogue for the marketplace wireframe. Nothing here is real: names,
 * sellers, prices and reviews are made up so the flows have something to show.
 */

export type CategoryId = 'electronics' | 'home' | 'fashion' | 'sports' | 'beauty' | 'books'

export interface Category { id: CategoryId; name: string; words: string[] }

export const CATEGORIES: Category[] = [
  { id: 'electronics', name: 'Electronics', words: ['electronic', 'gadget', 'phone', 'laptop', 'headphone', 'earbud', 'speaker', 'charger', 'keyboard', 'mouse', 'elektronik', 'hp', 'headset'] },
  { id: 'home', name: 'Home & Kitchen', words: ['home', 'kitchen', 'cook', 'coffee', 'lamp', 'chair', 'desk', 'pan', 'rumah', 'dapur', 'kopi', 'meja'] },
  { id: 'fashion', name: 'Fashion', words: ['fashion', 'shirt', 'jacket', 'bag', 'backpack', 'dress', 'shoe', 'sneaker', 'baju', 'jaket', 'tas', 'kaos'] },
  { id: 'sports', name: 'Sports', words: ['sport', 'running', 'run', 'gym', 'yoga', 'bike', 'cycling', 'fitness', 'olahraga', 'lari', 'sepeda'] },
  { id: 'beauty', name: 'Beauty', words: ['beauty', 'skincare', 'serum', 'sunscreen', 'moisturizer', 'cleanser', 'kulit', 'skin'] },
  { id: 'books', name: 'Books', words: ['book', 'novel', 'guide', 'cookbook', 'buku'] },
]

export interface Seller { id: string; name: string; city: string; rating: number; reply: string }

export const SELLERS: Seller[] = [
  { id: 'sl1', name: 'Gadget Corner', city: 'Jakarta', rating: 4.8, reply: 'within 1 hour' },
  { id: 'sl2', name: 'Rumah Rapi', city: 'Bandung', rating: 4.7, reply: 'within 2 hours' },
  { id: 'sl3', name: 'Lari Terus', city: 'Surabaya', rating: 4.9, reply: 'within 30 minutes' },
  { id: 'sl4', name: 'Kulit Sehat', city: 'Yogyakarta', rating: 4.6, reply: 'within 3 hours' },
  { id: 'sl5', name: 'Baca Pustaka', city: 'Medan', rating: 4.8, reply: 'within 1 hour' },
  { id: 'sl6', name: 'Urban Wear', city: 'Jakarta', rating: 4.5, reply: 'within 4 hours' },
]

export interface Review { author: string; rating: number; text: string; date: string }

export interface Product {
  id: string
  title: string
  category: CategoryId
  price: number
  oldPrice?: number
  rating: number
  reviewCount: number
  sold: number
  sellerId: string
  /** words the AI search matches on */
  tags: string[]
  /** option name → choices, e.g. Size → 40, 41, 42 */
  options?: Record<string, string[]>
  specs: Record<string, string>
  description: string
  /** the AI review summary, as the prototype shows it */
  pros: string[]
  cons: string[]
  reviews: Review[]
  stock: number
}

const R = (author: string, rating: number, text: string, date: string): Review => ({ author, rating, text, date })

export const PRODUCTS: Product[] = [
  {
    id: 'p1', title: 'Aero Run 2 Running Shoes', category: 'sports', price: 449000, oldPrice: 599000, rating: 4.7, reviewCount: 1284, sold: 5200, sellerId: 'sl3',
    tags: ['running', 'shoes', 'beginner', 'lightweight', 'daily', 'road', 'sepatu', 'lari'], options: { Size: ['39', '40', '41', '42', '43', '44'], Colour: ['Grey', 'Black', 'White'] },
    specs: { Weight: '240 g', Drop: '8 mm', Upper: 'Engineered mesh', Waterproof: 'No — mesh breathes, dries fast', Use: 'Road running, daily training', Fit: 'True to size; wide toe box' },
    description: 'A light, cushioned daily trainer for road running. Good first pair for beginners building up to 5–10 km.',
    pros: ['Light and comfortable from day one', 'Good cushioning for beginners', 'Fits true to size'], cons: ['Not waterproof', 'Outsole wears faster on rough roads'],
    reviews: [R('Dewi', 5, 'Very light. Ran my first 5K in these without blisters.', '2026-10-02'), R('Agus', 4, 'Comfortable, true to size. Sole looks worn after 3 months.', '2026-09-18'), R('Putri', 5, 'Great value for the price.', '2026-09-03')], stock: 34,
  },
  {
    id: 'p2', title: 'Trail Grip Pro Shoes', category: 'sports', price: 899000, rating: 4.6, reviewCount: 342, sold: 980, sellerId: 'sl3',
    tags: ['running', 'trail', 'shoes', 'waterproof', 'grip', 'hiking', 'sepatu'], options: { Size: ['40', '41', '42', '43', '44'] },
    specs: { Weight: '310 g', Drop: '6 mm', Upper: 'Ripstop with membrane', Waterproof: 'Yes — water-resistant membrane', Use: 'Trail running, light hiking', Fit: 'Runs half a size small' },
    description: 'Grippy lugs and a water-resistant upper for muddy trails.',
    pros: ['Excellent grip on wet ground', 'Keeps feet dry'], cons: ['Heavier than road shoes', 'Runs half a size small'],
    reviews: [R('Bima', 5, 'Grip is amazing on wet rocks.', '2026-10-10'), R('Sinta', 4, 'Order half a size up.', '2026-09-22')], stock: 12,
  },
  {
    id: 'p3', title: 'Breeze Running Tee', category: 'sports', price: 119000, rating: 4.5, reviewCount: 860, sold: 4100, sellerId: 'sl3',
    tags: ['running', 'shirt', 'tee', 'dry', 'gym', 'kaos', 'lari'], options: { Size: ['S', 'M', 'L', 'XL'], Colour: ['Grey', 'Black'] },
    specs: { Material: '100% recycled polyester', Fit: 'Regular', Care: 'Machine wash cold', Waterproof: 'No' },
    description: 'Quick-dry tee for runs and gym sessions.', pros: ['Dries quickly', 'Soft fabric'], cons: ['Fit is a little long'],
    reviews: [R('Rina', 5, 'Dries fast after a sweaty run.', '2026-10-01'), R('Andi', 4, 'A bit long for me.', '2026-09-10')], stock: 120,
  },
  {
    id: 'p4', title: 'Yoga Mat 6 mm', category: 'sports', price: 189000, oldPrice: 249000, rating: 4.6, reviewCount: 610, sold: 2300, sellerId: 'sl3',
    tags: ['yoga', 'mat', 'gym', 'home workout', 'beginner', 'fitness'], options: { Colour: ['Grey', 'Sage'] },
    specs: { Thickness: '6 mm', Size: '183 × 61 cm', Material: 'TPE, non-slip', Weight: '0.9 kg' },
    description: 'Cushioned, non-slip mat for yoga and home workouts.', pros: ['Comfortable on knees', 'Does not slip'], cons: ['Smells new for a few days'],
    reviews: [R('Maya', 5, 'Thick enough for my knees.', '2026-10-08')], stock: 48,
  },
  {
    id: 'p5', title: 'Pulse ANC Wireless Headphones', category: 'electronics', price: 1299000, oldPrice: 1599000, rating: 4.7, reviewCount: 2210, sold: 7800, sellerId: 'sl1',
    tags: ['headphones', 'wireless', 'noise cancelling', 'anc', 'bluetooth', 'work', 'travel', 'music'], options: { Colour: ['Black', 'Silver'] },
    specs: { Battery: 'Up to 40 hours (ANC on: 30 hours)', Connection: 'Bluetooth 5.3, multipoint', 'Noise cancelling': 'Yes, adaptive', Weight: '250 g', Waterproof: 'No', Warranty: '1 year' },
    description: 'Over-ear headphones with adaptive noise cancelling and all-day battery.', pros: ['Strong noise cancelling', 'Very long battery life', 'Comfortable for hours'], cons: ['Case is bulky', 'Mic is average on calls'],
    reviews: [R('Hendra', 5, 'Blocks out the office completely.', '2026-10-12'), R('Lia', 4, 'Great sound, calls are just OK.', '2026-09-30'), R('Fajar', 5, 'Battery lasts all week.', '2026-09-14')], stock: 22,
  },
  {
    id: 'p6', title: 'Buds Lite True Wireless Earbuds', category: 'electronics', price: 349000, rating: 4.4, reviewCount: 3120, sold: 15000, sellerId: 'sl1',
    tags: ['earbuds', 'wireless', 'bluetooth', 'budget', 'sport', 'running', 'music'], options: { Colour: ['White', 'Black'] },
    specs: { Battery: '6 hours (24 with case)', Connection: 'Bluetooth 5.2', 'Noise cancelling': 'No', Waterproof: 'IPX4 sweat resistant', Warranty: '6 months' },
    description: 'Small, light earbuds with a secure fit for workouts.', pros: ['Great value', 'Stay in during runs'], cons: ['No noise cancelling', 'Case scratches easily'],
    reviews: [R('Tika', 4, 'Good for running, they stay in.', '2026-10-05'), R('Yusuf', 4, 'Fine for the price.', '2026-09-20')], stock: 200,
  },
  {
    id: 'p7', title: 'Volt 65 W USB-C Charger', category: 'electronics', price: 279000, rating: 4.8, reviewCount: 940, sold: 6100, sellerId: 'sl1',
    tags: ['charger', 'usb-c', 'fast charging', 'laptop', 'phone', 'travel'],
    specs: { Output: '65 W total, 2 × USB-C + 1 × USB-A', Size: 'Pocket size', Warranty: '1 year' },
    description: 'Charges a laptop and a phone at the same time.', pros: ['Charges a laptop fast', 'Small for travel'], cons: ['Gets warm under full load'],
    reviews: [R('Arif', 5, 'Replaced three chargers with this.', '2026-10-03')], stock: 75,
  },
  {
    id: 'p8', title: 'Clicky Mechanical Keyboard', category: 'electronics', price: 649000, rating: 4.6, reviewCount: 520, sold: 1800, sellerId: 'sl1',
    tags: ['keyboard', 'mechanical', 'work', 'gaming', 'office'], options: { Switch: ['Brown', 'Red', 'Blue'] },
    specs: { Layout: '75%', Connection: 'USB-C and Bluetooth', Backlight: 'White', Warranty: '1 year' },
    description: 'Compact mechanical keyboard for work and play.', pros: ['Satisfying to type on', 'Connects to 3 devices'], cons: ['Blue switches are loud'],
    reviews: [R('Kevin', 5, 'Brown switches are perfect for the office.', '2026-09-27')], stock: 30,
  },
  {
    id: 'p9', title: 'Pour-Over Coffee Set', category: 'home', price: 229000, rating: 4.7, reviewCount: 410, sold: 1500, sellerId: 'sl2',
    tags: ['coffee', 'pour over', 'kitchen', 'gift', 'kopi', 'beginner'],
    specs: { Includes: 'Dripper, glass server 600 ml, 40 filters', Material: 'Ceramic and borosilicate glass' },
    description: 'Everything you need to start brewing pour-over at home.', pros: ['Nice gift', 'Easy to start with'], cons: ['Filters run out quickly'],
    reviews: [R('Nadia', 5, 'Bought it as a gift, they loved it.', '2026-10-09')], stock: 40,
  },
  {
    id: 'p10', title: 'Smart Desk Lamp', category: 'home', price: 319000, oldPrice: 399000, rating: 4.5, reviewCount: 380, sold: 1200, sellerId: 'sl2',
    tags: ['lamp', 'desk', 'study', 'work', 'office', 'lampu', 'meja'],
    specs: { Brightness: '5 levels', 'Colour temperature': '2700–6500 K', Power: 'USB-C', Waterproof: 'No' },
    description: 'Adjustable desk lamp with warm and cool light.', pros: ['Easy on the eyes', 'Good for late study'], cons: ['Touch buttons are sensitive'],
    reviews: [R('Sari', 4, 'Nice warm light for reading.', '2026-09-29')], stock: 26,
  },
  {
    id: 'p11', title: 'Non-Stick Frying Pan 28 cm', category: 'home', price: 259000, rating: 4.6, reviewCount: 720, sold: 3300, sellerId: 'sl2',
    tags: ['pan', 'kitchen', 'cooking', 'non-stick', 'dapur'],
    specs: { Size: '28 cm', Coating: 'Ceramic non-stick', Hob: 'Gas, electric, induction', Dishwasher: 'Hand wash recommended' },
    description: 'Everyday pan with a ceramic non-stick coating.', pros: ['Nothing sticks', 'Works on induction'], cons: ['Handle gets warm'],
    reviews: [R('Bayu', 5, 'Eggs slide right off.', '2026-10-06')], stock: 55,
  },
  {
    id: 'p12', title: 'Ergo Office Chair', category: 'home', price: 1890000, rating: 4.4, reviewCount: 260, sold: 640, sellerId: 'sl2',
    tags: ['chair', 'office', 'work', 'ergonomic', 'desk', 'kursi'],
    specs: { Support: 'Adjustable lumbar and armrests', Seat: 'Mesh', 'Max load': '120 kg', Assembly: 'About 20 minutes' },
    description: 'Mesh office chair with adjustable lumbar support.', pros: ['Back feels better after long days', 'Breathable mesh'], cons: ['Assembly instructions unclear'],
    reviews: [R('Reza', 4, 'Comfortable, assembly was a puzzle.', '2026-09-25')], stock: 9,
  },
  {
    id: 'p13', title: 'Everyday Canvas Backpack', category: 'fashion', price: 299000, rating: 4.6, reviewCount: 1050, sold: 4800, sellerId: 'sl6',
    tags: ['backpack', 'bag', 'laptop', 'work', 'school', 'travel', 'tas'], options: { Colour: ['Grey', 'Navy', 'Olive'] },
    specs: { Capacity: '22 L', 'Laptop sleeve': 'Fits 15.6"', Waterproof: 'Water-repellent canvas', Material: 'Canvas' },
    description: 'Simple canvas backpack with a padded laptop sleeve.', pros: ['Fits a lot', 'Laptop sleeve is well padded'], cons: ['Straps could be thicker'],
    reviews: [R('Laras', 5, 'My go-to bag for work.', '2026-10-11')], stock: 64,
  },
  {
    id: 'p14', title: 'Light Rain Jacket', category: 'fashion', price: 389000, oldPrice: 459000, rating: 4.5, reviewCount: 430, sold: 1900, sellerId: 'sl6',
    tags: ['jacket', 'rain', 'waterproof', 'travel', 'running', 'jaket'], options: { Size: ['S', 'M', 'L', 'XL'], Colour: ['Grey', 'Black'] },
    specs: { Waterproof: 'Yes — 5,000 mm', Weight: '210 g', Packs: 'Into its own pocket' },
    description: 'Packable rain jacket for commuting and travel.', pros: ['Packs small', 'Keeps rain out'], cons: ['Not breathable for hard runs'],
    reviews: [R('Citra', 5, 'Saved me in the rainy season.', '2026-10-04')], stock: 31,
  },
  {
    id: 'p15', title: 'Classic White Sneakers', category: 'fashion', price: 359000, rating: 4.4, reviewCount: 2040, sold: 9100, sellerId: 'sl6',
    tags: ['sneakers', 'shoes', 'casual', 'white', 'daily', 'sepatu'], options: { Size: ['38', '39', '40', '41', '42', '43'] },
    specs: { Upper: 'Synthetic leather', Sole: 'Rubber', Waterproof: 'No', Use: 'Casual, not for running' },
    description: 'Clean white sneakers that go with everything.', pros: ['Goes with any outfit', 'Comfortable for walking'], cons: ['Not for sport', 'Gets dirty easily'],
    reviews: [R('Putra', 4, 'Looks great, not for running though.', '2026-09-21')], stock: 80,
  },
  {
    id: 'p16', title: 'Daily Linen Shirt', category: 'fashion', price: 249000, rating: 4.3, reviewCount: 310, sold: 1100, sellerId: 'sl6',
    tags: ['shirt', 'linen', 'casual', 'work', 'baju'], options: { Size: ['S', 'M', 'L', 'XL'] },
    specs: { Material: 'Linen-cotton blend', Fit: 'Relaxed', Care: 'Machine wash, hang dry' },
    description: 'Breathable shirt for hot days.', pros: ['Cool in hot weather'], cons: ['Wrinkles easily'],
    reviews: [R('Dimas', 4, 'Comfortable, needs ironing.', '2026-09-16')], stock: 44,
  },
  {
    id: 'p17', title: 'Gentle Foam Cleanser', category: 'beauty', price: 89000, rating: 4.6, reviewCount: 4300, sold: 22000, sellerId: 'sl4',
    tags: ['cleanser', 'skincare', 'sensitive skin', 'face', 'daily', 'kulit'],
    specs: { Size: '150 ml', 'Skin type': 'All, including sensitive', Fragrance: 'Fragrance-free' },
    description: 'Mild daily cleanser that does not dry the skin.', pros: ['Gentle on sensitive skin', 'Lasts long'], cons: ['Does not remove heavy makeup'],
    reviews: [R('Ayu', 5, 'No more dry patches.', '2026-10-07')], stock: 300,
  },
  {
    id: 'p18', title: 'Daily Sunscreen SPF 50', category: 'beauty', price: 129000, rating: 4.7, reviewCount: 5100, sold: 31000, sellerId: 'sl4',
    tags: ['sunscreen', 'spf', 'skincare', 'oily skin', 'daily', 'face'],
    specs: { Protection: 'SPF 50 PA++++', Finish: 'Matte, no white cast', Size: '50 ml', 'Skin type': 'Oily and combination' },
    description: 'Light sunscreen with a matte finish for everyday use.', pros: ['No white cast', 'Not greasy'], cons: ['Small tube'],
    reviews: [R('Nina', 5, 'Finally a sunscreen that is not oily.', '2026-10-13')], stock: 260,
  },
  {
    id: 'p19', title: 'Hydrating Serum', category: 'beauty', price: 159000, oldPrice: 199000, rating: 4.5, reviewCount: 1800, sold: 8700, sellerId: 'sl4',
    tags: ['serum', 'skincare', 'dry skin', 'hydrating', 'face'],
    specs: { Key: 'Hyaluronic acid, panthenol', Size: '30 ml', 'Skin type': 'Dry and normal' },
    description: 'Lightweight serum for dry, tight skin.', pros: ['Skin feels plump', 'Absorbs fast'], cons: ['Dropper is fiddly'],
    reviews: [R('Fitri', 4, 'Works well under moisturiser.', '2026-09-19')], stock: 140,
  },
  {
    id: 'p20', title: 'Beginner’s Guide to Running', category: 'books', price: 99000, rating: 4.8, reviewCount: 640, sold: 2600, sellerId: 'sl5',
    tags: ['book', 'running', 'beginner', 'guide', 'buku', 'lari'],
    specs: { Pages: '220', Language: 'English', Format: 'Paperback' },
    description: 'A friendly 12-week plan from the couch to your first 10K.', pros: ['Easy to follow plan', 'Motivating'], cons: ['Some advice is basic'],
    reviews: [R('Hana', 5, 'Took me from zero to 10K.', '2026-10-01')], stock: 70,
  },
  {
    id: 'p21', title: 'Home Cooking in 30 Minutes', category: 'books', price: 139000, rating: 4.6, reviewCount: 420, sold: 1700, sellerId: 'sl5',
    tags: ['cookbook', 'cooking', 'kitchen', 'book', 'gift', 'buku'],
    specs: { Pages: '260', Language: 'English', Format: 'Hardcover' },
    description: '80 weeknight recipes with simple ingredients.', pros: ['Recipes really take 30 minutes', 'Nice photos'], cons: ['Few vegetarian recipes'],
    reviews: [R('Lina', 5, 'Cook from it every week.', '2026-09-23')], stock: 50,
  },
  {
    id: 'p22', title: 'Focus: Deep Work Habits', category: 'books', price: 119000, rating: 4.5, reviewCount: 980, sold: 3900, sellerId: 'sl5',
    tags: ['book', 'productivity', 'work', 'habits', 'buku'],
    specs: { Pages: '240', Language: 'English', Format: 'Paperback' },
    description: 'Practical habits for focused work.', pros: ['Practical tips'], cons: ['Repeats itself in the middle'],
    reviews: [R('Gita', 4, 'Useful, a bit long.', '2026-09-12')], stock: 65,
  },
  {
    id: 'p23', title: 'Portable Bluetooth Speaker', category: 'electronics', price: 499000, rating: 4.5, reviewCount: 1350, sold: 5600, sellerId: 'sl1',
    tags: ['speaker', 'bluetooth', 'portable', 'waterproof', 'music', 'travel', 'outdoor'], options: { Colour: ['Grey', 'Black'] },
    specs: { Battery: '15 hours', Waterproof: 'Yes — IP67', Connection: 'Bluetooth 5.3', Weight: '540 g' },
    description: 'Rugged speaker for the beach, the park and the shower.', pros: ['Loud for its size', 'Truly waterproof'], cons: ['Bass is light'],
    reviews: [R('Joko', 5, 'Dropped it in the pool, still works.', '2026-10-09')], stock: 58,
  },
  {
    id: 'p24', title: 'Insulated Water Bottle 750 ml', category: 'sports', price: 149000, rating: 4.7, reviewCount: 2600, sold: 12000, sellerId: 'sl3',
    tags: ['bottle', 'water', 'gym', 'running', 'travel', 'insulated', 'botol'], options: { Colour: ['Grey', 'Black', 'White'] },
    specs: { Capacity: '750 ml', Keeps: 'Cold 24 h, hot 12 h', Material: 'Stainless steel', Leakproof: 'Yes' },
    description: 'Keeps water cold all day.', pros: ['Stays cold all day', 'Does not leak'], cons: ['Heavy when full'],
    reviews: [R('Wulan', 5, 'Ice still there in the evening.', '2026-10-02')], stock: 150,
  },
]

export const product = (id: string) => PRODUCTS.find((p) => p.id === id)
export const seller = (id: string) => SELLERS.find((s) => s.id === id)
export const category = (id: string) => CATEGORIES.find((c) => c.id === id)

/** "Today" in the prototype, so dates read the same whenever it is opened. */
export const DEMO_NOW = new Date('2026-10-26T09:00:00')
