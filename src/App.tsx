import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ProductForm from './pages/ProductForm';
import Categories from './pages/Categories';
import Collections from './pages/Collections';
import Filters from './pages/Filters';
import Orders from './pages/Orders';
import Reviews from './pages/Reviews';
import Policies from './pages/Policies';
import Settings from './pages/Settings';
import HeroSlides from './pages/HeroSlides';
import Mattresses from './pages/Mattresses';
import { Toaster } from 'sonner';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    setIsLoggedIn(loggedIn);
  }, []);

  if (!isLoggedIn) {
    return (
      <Router>
        <Routes>
          <Route path="*" element={<Login onLogin={() => setIsLoggedIn(true)} />} />
        </Routes>
        <Toaster position="top-right" />
      </Router>
    );
  }

  return (
    <Router>
      <AdminLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/new" element={<ProductForm />} />
          <Route path="/products/edit/:id" element={<ProductForm />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/filters" element={<Filters />} />
          <Route path="/mattresses" element={<Mattresses />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/policies" element={<Policies />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/hero-slides" element={<HeroSlides />} />
        </Routes>
      </AdminLayout>
      <Toaster position="top-right" />
    </Router>
  );
}

export default App;
