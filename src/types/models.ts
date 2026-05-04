// src/types/models.ts

export interface OrderItem {
    _id: string;
    productId: string;
    name: string;
    quantity: number;
    price: number;
    productImage?: string;
    vendorId: string; // Mongoose ObjectId reference
    status?: string; // If individual item status exists
}

export interface Address {
    fullName?: string;
    street?: string;
    street2?: string;
    landmark?: string;
    city?: string;
    state: string; // Made required based on form
    zipCode: string; // Made required based on form (pincode)
    country: string; // Made required based on form
    latitude?: number;
    longitude?: number;
    phone?: string;
}

export interface User {
    _id: string;
    name?: string;
    email?: string;
    phone?: string;
}

export interface DeliveryBoy {
    _id: string;
    name?: string;
    email?: string;
    phone?: string;
    // Add other relevant delivery boy fields (e.g., photo, vehicle)
}

export interface Order {
    _id: string;
    user?: User; // Populated with basic user info
    items: OrderItem[];
    address?: Address; // User's delivery address
    paymentMethod?: string;
    status: string; // e.g., 'placed', 'processing', 'shipped', 'delivered', 'cancelled'
    createdAt: string;
    updatedAt: string;
    total?: number;
    deliveryBoy?: DeliveryBoy; // Assigned delivery boy, can be null
    vendorTotal?: number; // Added based on your provided data if it's separate from general total
    // Add any other relevant order properties from your backend (e.g., orderId, specific timestamps)
}

export interface Vendor {
    _id: string;
    name: string;
    shopName: string;
    email: string;
    phone: string;
    address: {
        latitude?: number;
        longitude?: number;
        pincode: string;
        state: string;
        district: string;
        country: string;
    };
    isOnline: boolean;
    isApproved: boolean; // Assuming this field exists based on usage in getStatusDisplay
    deliveryRange?: number;
    shopImage?: string;
    businessType?: string;
    gstNo?: string;
}
