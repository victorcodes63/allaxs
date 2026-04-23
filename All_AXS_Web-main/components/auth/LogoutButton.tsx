"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import axios from "axios";
import { useAuth } from "@/lib/auth";

export function LogoutButton() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleClick = async () => {
    if (!user) {
      // User is logged out, navigate to login
      router.push("/login");
      return;
    }

    // User is logged in, handle logout
    setIsLoggingOut(true);
    try {
      await axios.post("/api/auth/logout");
      router.replace("/login");
    } catch (error) {
      console.error("Logout error:", error);
      // Even if logout fails, redirect to login
      router.replace("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Always render the button, show loading state if needed
  const buttonText = loading
    ? "Loading..."
    : user
      ? isLoggingOut
        ? "Logging out..."
        : "Logout"
      : "Sign in";

  return (
    <Button
      variant="primary"
      onClick={handleClick}
      disabled={loading || isLoggingOut}
      className="w-auto min-w-[100px]"
    >
      {buttonText}
    </Button>
  );
}

