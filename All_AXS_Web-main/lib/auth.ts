"use client";

import { useState, useEffect } from "react";
import axios from "axios";

interface User {
  id: string;
  email: string;
  name?: string;
  roles?: string[];
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        // First, try to get user info from access token (no refresh needed)
        const response = await axios.get("/api/auth/me");
        if (response.data?.user) {
          setUser(response.data.user);
          setLoading(false);
          return;
        }
        // If no user in response, set to null
        setUser(null);
        setLoading(false);
      } catch (error) {
        // If access token is invalid/expired (401), try to refresh
        if ((error as { response?: { status?: number } }).response?.status === 401) {
          try {
            const refreshResponse = await axios.post("/api/auth/refresh");
            if (refreshResponse.data?.user) {
              setUser(refreshResponse.data.user);
              setLoading(false);
              return;
            }
          } catch {
            // Refresh failed, user is not authenticated
            setUser(null);
            setLoading(false);
            return;
          }
        }
        // For any other error, user is not authenticated
        setUser(null);
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  return { user, loading };
}
