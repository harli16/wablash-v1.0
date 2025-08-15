import React from 'react';
import jwtDecode from 'jwt-decode';
import { Navigate } from 'react-router-dom';

export default function AdminRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" />;

  try {
    const decoded = jwtDecode(token);
    if (decoded.role !== 'admin') {
      return <Navigate to="/dashboard" />;
    }
    return children;
  } catch (e) {
    return <Navigate to="/login" />;
  }
}
