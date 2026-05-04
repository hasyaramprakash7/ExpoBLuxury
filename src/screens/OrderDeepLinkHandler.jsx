import React, { useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';

/**
 * Component responsible for detecting deep links (Razorpay payment callbacks)
 * and navigating the user to the Order Status screen.
 * * This should be mounted high up in your navigation stack (e.g., inside your main navigator) 
 * to catch links when the app opens from an external browser.
 */
const OrderDeepLinkHandler = () => {
  const navigation = useNavigation();

  // ⚠️ ACTION REQUIRED: REPLACE 'yourapp' with the actual scheme you defined in your backend router
  const DEEP_LINK_SCHEME = 'yourapp'; 

  // Function to handle the incoming URL and parse parameters
  const handleDeepLink = (url) => {
    if (!url) return;

    // Check if the URL matches the expected deep link scheme (e.g., yourapp://order/status)
    if (url.startsWith(`${DEEP_LINK_SCHEME}://order/status`)) {
      // Use URLSearchParams to easily parse the query string from the URL
      const urlParts = url.split('?');
      if (urlParts.length > 1) {
        // Since URLSearchParams is not native, we manually parse the query string for robustness
        const queryString = urlParts[1];
        const params = {};
        queryString.split('&').forEach(pair => {
            const [key, value] = pair.split('=');
            params[decodeURIComponent(key)] = decodeURIComponent(value);
        });

        const paymentId = params['paymentId']; 
        const linkId = params['linkId'];      
        const paymentFailed = params['paymentFailed'] === 'true';

        console.log(`Deep Link Detected: Payment ID: ${paymentId}, Status: ${paymentFailed ? 'Failed' : 'Success/Pending'}`);
        
        // Navigate to the Order Status screen (where the confirmation UI lives)
        // Note: 'UserOrderScreen' is the Stack/Tab navigator name, 'OrderConfirmationScreen' is the screen name inside it.
        navigation.navigate('UserOrderScreen', { 
          screen: 'OrderConfirmationScreen',
          params: { paymentId, linkId, paymentFailed } // Pass data to the confirmation screen
        });
      }
    }
  };

  useEffect(() => {
    // 1. Handle app launch from deep link (when the app is closed)
    Linking.getInitialURL().then(handleDeepLink);

    // 2. Handle app opened while running in background
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Clean up the subscription
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [navigation]);

  // This component renders nothing; it only handles logic
  return null;
};

export default OrderDeepLinkHandler;
