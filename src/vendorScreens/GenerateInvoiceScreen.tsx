import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import dayjs from "dayjs";
import { Order, Vendor } from '../types/models'; // Import your types

// Define the RootStackParamList to ensure type safety for navigation
type RootStackParamList = {
    VendorOrderList: undefined;
    GenerateInvoice: { orderData: Order; vendorData: Vendor }; // This screen's own route
    // Add other relevant routes for navigation if needed
};

type GenerateInvoiceScreenNavigationProp = StackNavigationProp<RootStackParamList, 'GenerateInvoice'>;
type GenerateInvoiceScreenRouteProp = RouteProp<RootStackParamList, 'GenerateInvoice'>;

// --- Mock InvoiceGenerator Component (Replace with your actual implementation) ---
interface InvoiceGeneratorProps {
    initialInvoiceData: {
        invoiceNumber: string;
        date: string;
        dueDate: string;
        customer: {
            name: string;
            email: string;
            phone: string;
            address: string;
        };
        vendor: {
            name: string;
            email: string;
            phone: string;
            address: string;
            gst?: string;
        };
        items: Array<{
            id: string;
            name: string;
            quantity: number;
            price: number;
            total: number;
        }>;
        tax: number;
        discount: number;
        subtotal: number;
        discountAmount: number;
        taxAmount: number;
        finalTotal: number;
    };
}

const InvoiceGenerator: React.FC<InvoiceGeneratorProps> = ({ initialInvoiceData }) => {
    // In a real application, this component would handle PDF generation,
    // printing, or a complex interactive invoice display.
    // For now, it simply displays the data.

    const handlePrint = () => {
        Alert.alert("Print Invoice", "Printing functionality would be implemented here!");
        // Example: You might use libraries like 'expo-print' or 'react-native-html-to-pdf'
    };

    const handleShare = () => {
        Alert.alert("Share Invoice", "Sharing functionality would be implemented here!");
        // Example: You might use 'expo-sharing'
    };

    return (
        <ScrollView style={invoiceStyles.container}>
            <View style={invoiceStyles.invoiceCard}>
                <Text style={invoiceStyles.headerTitle}>INVOICE</Text>
                <Text style={invoiceStyles.invoiceNumber}>#{initialInvoiceData.invoiceNumber}</Text>

                <View style={invoiceStyles.section}>
                    <View style={invoiceStyles.vendorInfo}>
                        <Text style={invoiceStyles.sectionHeader}>From:</Text>
                        <Text style={invoiceStyles.infoName}>{initialInvoiceData.vendor.name}</Text>
                        <Text style={invoiceStyles.infoText}>{initialInvoiceData.vendor.email}</Text>
                        <Text style={invoiceStyles.infoText}>{initialInvoiceData.vendor.phone}</Text>
                        <Text style={invoiceStyles.infoText}>{initialInvoiceData.vendor.address}</Text>
                        {initialInvoiceData.vendor.gst && <Text style={invoiceStyles.infoText}>GST: {initialInvoiceData.vendor.gst}</Text>}
                    </View>

                    <View style={invoiceStyles.customerInfo}>
                        <Text style={invoiceStyles.sectionHeader}>Bill To:</Text>
                        <Text style={invoiceStyles.infoName}>{initialInvoiceData.customer.name}</Text>
                        <Text style={invoiceStyles.infoText}>{initialInvoiceData.customer.email}</Text>
                        <Text style={invoiceStyles.infoText}>{initialInvoiceData.customer.phone}</Text>
                        <Text style={invoiceStyles.infoText}>{initialInvoiceData.customer.address}</Text>
                    </View>
                </View>

                <View style={invoiceStyles.section}>
                    <View style={invoiceStyles.dateInfo}>
                        <Text style={invoiceStyles.dateLabel}>Invoice Date:</Text>
                        <Text style={invoiceStyles.dateValue}>{initialInvoiceData.date}</Text>
                    </View>
                    <View style={invoiceStyles.dateInfo}>
                        <Text style={invoiceStyles.dateLabel}>Due Date:</Text>
                        <Text style={invoiceStyles.dateValue}>{initialInvoiceData.dueDate}</Text>
                    </View>
                </View>

                <View style={invoiceStyles.itemsTable}>
                    <View style={invoiceStyles.tableHeader}>
                        <Text style={[invoiceStyles.tableHeaderText, { flex: 3 }]}>Item</Text>
                        <Text style={[invoiceStyles.tableHeaderText, { flex: 1 }]}>Qty</Text>
                        <Text style={[invoiceStyles.tableHeaderText, { flex: 1 }]}>Price</Text>
                        <Text style={[invoiceStyles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Total</Text>
                    </View>
                    {initialInvoiceData.items.map((item) => (
                        <View key={item.id} style={invoiceStyles.tableRow}>
                            <Text style={[invoiceStyles.tableCell, { flex: 3 }]}>{item.name}</Text>
                            <Text style={[invoiceStyles.tableCell, { flex: 1 }]}>{item.quantity}</Text>
                            <Text style={[invoiceStyles.tableCell, { flex: 1 }]}>₹{item.price.toFixed(2)}</Text>
                            <Text style={[invoiceStyles.tableCell, { flex: 1, textAlign: 'right' }]}>₹{item.total.toFixed(2)}</Text>
                        </View>
                    ))}
                </View>

                <View style={invoiceStyles.summaryContainer}>
                    <View style={invoiceStyles.summaryRow}>
                        <Text style={invoiceStyles.summaryLabel}>Subtotal:</Text>
                        <Text style={invoiceStyles.summaryValue}>₹{initialInvoiceData.subtotal.toFixed(2)}</Text>
                    </View>
                    {initialInvoiceData.discountAmount > 0 && (
                        <View style={invoiceStyles.summaryRow}>
                            <Text style={invoiceStyles.summaryLabel}>Discount ({initialInvoiceData.discount}%):</Text>
                            <Text style={invoiceStyles.summaryValue}>- ₹{initialInvoiceData.discountAmount.toFixed(2)}</Text>
                        </View>
                    )}
                    <View style={invoiceStyles.summaryRow}>
                        <Text style={invoiceStyles.summaryLabel}>Tax ({initialInvoiceData.tax}%):</Text>
                        <Text style={invoiceStyles.summaryValue}>+ ₹{initialInvoiceData.taxAmount.toFixed(2)}</Text>
                    </View>
                    <View style={[invoiceStyles.summaryRow, invoiceStyles.finalTotalRow]}>
                        <Text style={invoiceStyles.finalTotalLabel}>Grand Total:</Text>
                        <Text style={invoiceStyles.finalTotalValue}>₹{initialInvoiceData.finalTotal.toFixed(2)}</Text>
                    </View>
                </View>

                <View style={invoiceStyles.actionsContainer}>
                    <TouchableOpacity onPress={handlePrint} style={invoiceStyles.actionButton}>
                        <Text style={invoiceStyles.actionButtonText}>Print Invoice</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleShare} style={invoiceStyles.actionButton}>
                        <Text style={invoiceStyles.actionButtonText}>Share Invoice</Text>
                    </TouchableOpacity>
                </View>

                <Text style={invoiceStyles.footerText}>Thank you for your business!</Text>
            </View>
        </ScrollView>
    );
};

const GenerateInvoiceScreen = () => {
    const navigation = useNavigation<GenerateInvoiceScreenNavigationProp>();
    const route = useRoute<GenerateInvoiceScreenRouteProp>();
    const [invoiceData, setInvoiceData] = useState<InvoiceGeneratorProps['initialInvoiceData'] | null>(null);

    useEffect(() => {
        if (route.params && route.params.orderData && route.params.vendorData) {
            const { orderData, vendorData } = route.params;

            const vendorItems = orderData.items.filter(item =>
                item.vendorId.toString() === vendorData._id.toString()
            ).map(item => ({
                id: item._id,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                total: item.quantity * item.price
            }));

            const subtotal = vendorItems.reduce((sum, item) => sum + item.total, 0);

            // Example: assuming taxRate is on order or default
            const taxRate = orderData.taxRate || 18;
            const discountRate = orderData.discountRate || 0;

            const discountAmount = (subtotal * discountRate) / 100;
            const taxableAmount = subtotal - discountAmount;
            const taxAmount = (taxableAmount * taxRate) / 100;
            const finalTotal = taxableAmount + taxAmount;

            const formattedInvoiceData = {
                invoiceNumber: `INV-${orderData._id.slice(-8)}-${dayjs().format('YYYYMMDD')}`,
                date: dayjs(orderData.createdAt).format('YYYY-MM-DD'),
                dueDate: dayjs(orderData.createdAt).add(7, 'day').format('YYYY-MM-DD'),
                customer: {
                    name: orderData.user?.name || 'N/A',
                    email: orderData.user?.email || 'N/A',
                    phone: orderData.address?.phone || 'N/A',
                    address: `${orderData.address?.street}, ${orderData.address?.city}, ${orderData.address?.state} - ${orderData.address?.zipCode}, ${orderData.address?.country}`
                },
                vendor: {
                    name: vendorData.name,
                    email: vendorData.email,
                    phone: vendorData.phone,
                    address: `${vendorData.address?.street}, ${vendorData.address?.city}, ${vendorData.address?.state} - ${vendorData.address?.zipCode}, ${vendorData.address?.country}`,
                    gst: vendorData.gstNo // Assuming vendor object has a gstNo field
                },
                items: vendorItems,
                tax: taxRate,
                discount: discountRate,
                subtotal: subtotal,
                discountAmount: discountAmount,
                taxAmount: taxAmount,
                finalTotal: finalTotal
            };
            setInvoiceData(formattedInvoiceData);
        } else {
            Alert.alert('Error', 'No order data found to generate invoice.');
            navigation.goBack(); // Redirect to previous screen if no data
        }
    }, [route.params, navigation]);

    if (!invoiceData) {
        return (
            <View style={invoiceStyles.loadingContainer}>
                <ActivityIndicator size="large" color="#4f46e5" />
                <Text style={invoiceStyles.loadingText}>Loading invoice data...</Text>
            </View>
        );
    }

    return <InvoiceGenerator initialInvoiceData={invoiceData} />;
};

const invoiceStyles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#475569',
    },
    container: {
        flex: 1,
        backgroundColor: '#f8fafc', // slate-50
        padding: 16,
    },
    invoiceCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        padding: 24,
        marginBottom: 24,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1e293b', // gray-800
        textAlign: 'center',
        marginBottom: 8,
    },
    invoiceNumber: {
        fontSize: 18,
        color: '#475569', // gray-600
        textAlign: 'center',
        marginBottom: 24,
        fontWeight: '500',
    },
    section: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
        flexWrap: 'wrap', // Allow wrapping for smaller screens
    },
    sectionHeader: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b', // gray-800
        marginBottom: 8,
    },
    vendorInfo: {
        flex: 1,
        minWidth: '48%', // Approx half width
        marginBottom: 16, // For wrapping
    },
    customerInfo: {
        flex: 1,
        minWidth: '48%',
        marginBottom: 16, // For wrapping
        alignItems: 'flex-end', // Align customer info to the right
        textAlign: 'right', // Text alignment for customer info
    },
    infoName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151', // gray-700
    },
    infoText: {
        fontSize: 14,
        color: '#475569', // gray-600
    },
    dateInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '48%', // For side-by-side dates
        marginBottom: 8,
    },
    dateLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
    dateValue: {
        fontSize: 14,
        color: '#475569',
    },
    itemsTable: {
        borderWidth: 1,
        borderColor: '#e5e7eb', // gray-200
        borderRadius: 8,
        marginBottom: 24,
        overflow: 'hidden', // Ensures border radius applies to children
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f3f4f6', // gray-100
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    tableHeaderText: {
        fontWeight: 'bold',
        color: '#475569', // gray-600
        fontSize: 12,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6', // lighter gray for row separation
    },
    tableCell: {
        fontSize: 13,
        color: '#1e293b', // gray-800
    },
    summaryContainer: {
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        paddingTop: 16,
        marginBottom: 24,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 15,
        color: '#374151', // gray-700
    },
    summaryValue: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1e293b', // gray-800
    },
    finalTotalRow: {
        borderTopWidth: 2,
        borderTopColor: '#e5e7eb',
        paddingTop: 12,
        marginTop: 12,
    },
    finalTotalLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    finalTotalValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#059669', // green-700
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 24,
    },
    actionButton: {
        backgroundColor: '#4f46e5', // indigo-600
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    actionButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    footerText: {
        fontSize: 14,
        color: '#6b7280', // gray-500
        textAlign: 'center',
        marginTop: 16,
    },
});

export default GenerateInvoiceScreen;
