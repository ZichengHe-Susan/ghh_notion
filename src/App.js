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

function App() {
  const [showChat, setShowChat] = useState(false);

  return (
    <Router>
      <AuthProvider>
        <CartProvider>
          <SocketProvider>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/upload" element={<AddItem />} />
              <Route path="/items" element={<ViewItems />} />
              <Route path="/cart" element={<ShoppingCart />} />
              <Route path="/item/:id" element={<ItemDetails />} />
              <Route path="/checkedOut" element={<Checkout />} />
              <Route path="/verify-email" element={<EmailVerification />} />
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
    </Router>
  );
}

export default App;
