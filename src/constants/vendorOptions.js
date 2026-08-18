// src/constants/vendorOptions.js

export const BUSINESS_TYPES = [
  'Retail',
  'Food & Beverage',
  'Electronics',
  'Fashion & Apparel',
  'Health & Wellness',
  'Home & Living',
  'Automotive',
  'Education',
  'Entertainment',
  'Services',
  'Real Estate',
  'Finance',
  'Travel & Hospitality',
  'Other',
];

// Expanded base categories – includes Car Wash and many more
const baseCategories = [
  'Restaurant', 'Cafe', 'Fast Food', 'Bakery', 'Clothing Store', 'Shoe Store',
  'Jewelry', 'Electronics Store', 'Mobile Store', 'Computer Store', 'Grocery',
  'Supermarket', 'Convenience Store', 'Pharmacy', 'Hospital', 'Clinic', 'Gym',
  'Spa', 'Salon', 'Pet Store', 'Furniture Store', 'Hardware Store', 'Bookstore',
  'Toy Store', 'Sports Store', 'Art Gallery', 'Music Store', 'Optician', 'Florist',
  'Event Planner', 'Travel Agent', 'Hotel', 'Resort', 'Guest House', 'Hostel',
  'Car Rental', 'Taxi Service', 'Laundry', 'Dry Cleaning', 'Tailor', 'Photography',
  'Catering', 'Party Rentals', 'Tutoring', 'Dance Studio', 'Art School', 'Driving School',
  // ===== NEW ONES =====
  'Car Wash', 'Auto Repair', 'Auto Service', 'Car Detailing', 'Tire Shop', 'Oil Change',
  'Plumbing', 'Electrician', 'HVAC', 'Roofing', 'Landscaping', 'Painting',
  'Cleaning Service', 'Pest Control', 'Locksmith', 'Handyman', 'Appliance Repair',
  'Computer Repair', 'Phone Repair', 'Watch Repair', 'Jewelry Repair',
  'Daycare', 'Preschool', 'After School Program', 'Summer Camp',
  'Dental Clinic', 'Dermatologist', 'Optometrist', 'Psychologist', 'Veterinarian',
  'Yoga Studio', 'Pilates', 'Martial Arts', 'Swimming Pool',
  'Printing Service', 'Copy Center', 'Sign Shop', 'Embroidery',
  'Catering', 'Food Truck', 'Ice Cream Shop', 'Juice Bar', 'Smoothie Bar',
  'Barber Shop', 'Nail Salon', 'Waxing Studio', 'Tattoo Studio', 'Piercing Studio',
  'Bicycle Shop', 'Motorcycle Shop', 'Boat Rental', 'Equipment Rental',
  'Farmers Market', 'Organic Store', 'Health Food Store', 'Vitamin Shop',
  'Liquor Store', 'Wine Shop', 'Brewery', 'Distillery', 'Hookah Lounge',
  'Arcade', 'Bowling Alley', 'Mini Golf', 'Escape Room', 'Trampoline Park',
  'Wedding Planner', 'Floral Designer', 'Cake Decorator', 'Bridal Shop',
  'Legal Services', 'Accounting', 'Insurance Agency', 'Real Estate Agent',
  'Property Management', 'Architect', 'Interior Designer',
];

const prefixes = ['Premium ', 'Luxury ', 'Budget ', 'Express ', 'Family ', 'Kids ', 'Pet ', 'Organic ', 'Gourmet ', 'Artisan '];
const suffixes = [' & Co', ' Boutique', ' Studio', ' Hub', ' Center', ' Place', ' Spot', ' Corner', ' House', ' Works'];

export const CATEGORIES_FINAL = [];
for (let i = 0; i < 20; i++) {
  for (const base of baseCategories) {
    const prefix = prefixes[i % prefixes.length] || '';
    const suffix = suffixes[i % suffixes.length] || '';
    CATEGORIES_FINAL.push(`${prefix}${base}${suffix}`);
  }
}
// Remove duplicates and slice to 2000
export const CATEGORIES = [...new Set(CATEGORIES_FINAL)].slice(0, 2000);

export const SERVICES = [
  'Dine-in', 'Takeaway', 'Delivery', 'Catering', 'Online Ordering',
  'Curbside Pickup', 'Home Service', 'In-store Shopping', 'Consultation',
  'Appointment Required', 'Walk-in Welcome', 'Fitting/Measuring', 'Repair',
  'Installation', 'Maintenance', 'Training', 'Workshops', 'Events',
  'Parties', 'Rentals', 'Cleaning', 'Laundry', 'Tailoring', 'Fixing',
];

export const TAGS = [
  'Vegetarian', 'Non-Vegetarian', 'Vegan', 'Gluten-Free', 'Halal',
  'Kosher', 'Organic', 'Family-Friendly', 'Pet-Friendly', 'Wheelchair Accessible',
  'Wi-Fi', 'Parking', 'Outdoor Seating', 'Air Conditioning', 'Takeout',
  'Delivery', 'Dine-in', 'Luxury', 'Budget', 'Mid-Range', 'Premium',
  'Sustainable', 'Locally Sourced', '24/7 Open', 'Accepts Cards',
];