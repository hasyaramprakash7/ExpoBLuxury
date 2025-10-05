import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { RootState, AppDispatch } from '../app/store';
import { fetchVendorAppointments } from '../features/appointmentSlice';

// Define the shape of your appointment data
interface Appointment {
  _id: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: string;
  userId: {
    name?: string;
    email?: string;
    phone?: string;
    address?: {
      pincode?: string;
      district?: string;
      state?: string;
      country?: string;
    };
  };
  insuranceProductId: {
    name?: string;
    description?: string;
    mainImage?: string;
  };
}

const VendorAppointmentsList: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();

  // Safely access the vendorAppointments array, defaulting to an empty array if undefined
  const { vendorAppointments = [], loading, error } = useSelector((state: RootState) => state.appointments);
  const { vendor } = useSelector((state: RootState) => state.vendorAuth);
  const vendorId = vendor?._id;

  useEffect(() => {
    // Only dispatch the fetch action if both vendorId and a token exist
    if (vendorId) {
      dispatch(fetchVendorAppointments(vendorId));
    }
  }, [dispatch, vendorId]); 

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4B5563" />
        <Text style={styles.loadingText}>Loading appointments...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Appointments Dashboard</Text>
      </View>

      {vendorAppointments.length > 0 ? (
        <ScrollView style={styles.listContainer}>
          {vendorAppointments.map((appointment: Appointment) => (
            <View key={appointment._id} style={styles.appointmentCard}>
              {/* Product and User Info Section */}
              <View style={styles.infoSection}>
                {/* Product Image */}
                <View style={styles.imageWrapper}>
                  <Image
                    source={{ uri: appointment.insuranceProductId?.mainImage || 'https://via.placeholder.com/150' }}
                    style={styles.productImage}
                  />
                </View>

                {/* Product and User Details */}
                <View style={styles.detailsWrapper}>
                  <Text style={styles.productName}>{appointment.insuranceProductId?.name || 'Product Not Found'}</Text>

                  <View style={styles.descriptionText}>
                    <Text>
                      <Text style={styles.boldText}>Description:</Text> {appointment.insuranceProductId?.description?.substring(0, 100) + '...' || 'N/A'}
                    </Text>
                  </View>

                  <Text style={styles.userText}>User: <Text style={styles.userNameText}>{appointment.userId?.name || 'User Not Found'}</Text></Text>

                  <View style={styles.contactDetails}>
                    <Text style={styles.contactText}>Email: {appointment.userId?.email || 'N/A'}</Text>
                    <Text style={styles.contactText}>Phone: {appointment.userId?.phone || 'N/A'}</Text>
                    <Text style={styles.contactText}>
                      Address: {appointment.userId?.address ? `${appointment.userId.address.pincode || ''}, ${appointment.userId.address.district || ''}, ${appointment.userId.address.state || ''}, ${appointment.userId.address.country || ''}` : 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Appointment Details Section */}
              <View style={styles.appointmentDetails}>
                <Text style={styles.dateText}>
                  <Text style={styles.boldText}>Appointment Date:</Text> {new Date(appointment.createdAt).toLocaleDateString()}
                </Text>
                
                <View style={styles.statusContainer}>
                  <Text style={styles.statusLabel}>Status:</Text>
                  <Text style={[
                    styles.statusBadge,
                    appointment.status === 'scheduled' ? styles.statusScheduled : styles.statusCompleted,
                  ]}>
                    {appointment.status || 'N/A'}
                  </Text>
                </View>

                <TouchableOpacity style={styles.button}>
                  <Text style={styles.buttonText}>View Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.noAppointmentsContainer}>
          <Text style={styles.noAppointmentsText}>You have no scheduled appointments at the moment.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    top: Platform.OS === 'ios' ? 60 : 20,
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    fontSize: 18,
    color: '#4B5563',
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    textAlign: 'center',
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  appointmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
    flexDirection: 'column',
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  imageWrapper: {
    marginRight: 20,
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  detailsWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 12,
  },
  userText: {
    fontSize: 16,
    color: '#4B5563',
    fontWeight: '600',
    marginBottom: 4,
  },
  userNameText: {
    color: '#2563EB',
    fontWeight: 'normal',
  },
  contactDetails: {
    marginTop: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  appointmentDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
    alignItems: 'flex-start',
  },
  dateText: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 8,
  },
  boldText: {
    fontWeight: 'bold',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4B5563',
    marginRight: 8,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    fontSize: 12,
  },
  statusScheduled: {
    backgroundColor: '#DBEAFE',
    color: '#1E40AF',
  },
  statusCompleted: {
    backgroundColor: '#D1FAE5',
    color: '#065F46',
  },
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  noAppointmentsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
    padding: 20,
  },
  noAppointmentsText: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default VendorAppointmentsList;