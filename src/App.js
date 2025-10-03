import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import { AuthProvider } from './contexts/AuthContext'; 
import { CartProvider } from './contexts/CartContext';
import { SocketProvider } from './contexts/SocketContext';
import AddItem from './pages/Upload';
import ViewItems from './pages/ViewItems';
import ShoppingCart from './pages/ShoppingCart';
import ItemDetails from './pages/ItemDetail';
import Checkout from './pages/Checkout';
import ChatInterface from './components/ChatInterface';
import ChatButton from './components/ChatButton';
import EmailVerification from './pages/EmailVerification';
import EmailChangeVerification from './pages/EmailChangeVerification';
import ProtectedRoute from './components/ProtectedRoute';
import StripeProvider from './components/StripeProvider';
import OrderConfirmation from './components/OrderConfirmation';
import StripeOnboarding from './components/StripeOnboarding';
import OnboardingSuccess from './pages/OnboardingSuccess';
import OnboardingRefresh from './pages/OnboardingRefresh';

function App() {
  const [showChat, setShowChat] = useState(false);

  return (
    <Router>
      <StripeProvider>
        <AuthProvider>
          <CartProvider>
            <SocketProvider>
              <Routes>
              <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/login" element={<Login />} />
              <Route path="/upload" element={<ProtectedRoute><AddItem /></ProtectedRoute>} />
              <Route path="/items" element={<ProtectedRoute><ViewItems /></ProtectedRoute>} />
              <Route path="/cart" element={<ProtectedRoute><ShoppingCart /></ProtectedRoute>} />
              <Route path="/item/:id" element={<ProtectedRoute><ItemDetails /></ProtectedRoute>} />
              <Route path="/checkedOut" element={<ProtectedRoute><OrderConfirmation /></ProtectedRoute>} />
              <Route path="/verify-email" element={<EmailVerification />} />
              <Route path="/verify-email-change" element={<EmailChangeVerification />} />
              <Route path="/seller/onboarding" element={<ProtectedRoute><StripeOnboarding /></ProtectedRoute>} />
              <Route path="/seller/onboarding/success" element={<ProtectedRoute><OnboardingSuccess /></ProtectedRoute>} />
              <Route path="/seller/onboarding/refresh" element={<ProtectedRoute><OnboardingRefresh /></ProtectedRoute>} />
            </Routes>
            
            {/* Chat Interface */}
            {showChat && (
              <ChatInterface onClose={() => setShowChat(false)} />
            )}
            
            {/* Chat Button */}
            <ChatButton onClick={() => setShowChat(true)} />
            </SocketProvider>
          </CartProvider>
        </AuthProvider>
      </StripeProvider>
    </Router>
  );
}

export default App;
