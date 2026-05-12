"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import axios from "axios";
import { useAuth } from "@/lib/auth";

export function LogoutButton() {
  const router = useRouter();
  const { user, loading, setUser } = useAuth();
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
    } catch (error) {
      console.error("Logout error:", error);
      // Even if logout fails, fall through to clear local state and redirect.
    } finally {
      setIsLoggingOut(false);
      // Clear the shared auth context immediately so every consumer
      // (top bar, dashboards, page guards) flips to signed-out state
      // before the next navigation. Without this, `useAuth` is now a
      // shared context that wouldn't otherwise refetch on this client.
      setUser(null);
      router.replace("/login");
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

