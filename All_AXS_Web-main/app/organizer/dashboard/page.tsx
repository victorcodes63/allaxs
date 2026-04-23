"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";

export default function OrganizerDashboardPage(): React.ReactElement {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkProfile = async () => {
      try {
        const response = await axios.get("/api/organizer/profile");
        if (response.status === 404 || !response.data) {
          // No profile exists, redirect to onboarding
          router.replace("/organizer/onboarding");
          return;
        }
        // Profile exists, continue showing dashboard
        setIsChecking(false);
      } catch (err) {
        if ((err as { response?: { status?: number } }).response?.status === 404) {
          // No profile exists, redirect to onboarding
          router.replace("/organizer/onboarding");
        } else {
          console.error("Error checking profile:", err);
          setIsChecking(false);
        }
      }
    };

    checkProfile();
  }, [router]);

  if (isChecking) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-black/60">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Organizer Dashboard</h1>
        <p className="text-lg text-black/60">
          Welcome to your organizer dashboard
        </p>
      </div>

      <div className="bg-black/5 rounded-lg p-6 space-y-4">
        <p className="text-black/80">
          Your organizer profile has been set up successfully.
        </p>
        <p className="text-black/80">
          You can manage your events, view analytics, and update your payout
          information from here.
        </p>
      </div>

      {/* Event Management Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Event Management</h2>
        <div className="flex gap-3">
          <Link
            href="/organizer/events/new"
            className="bg-primary text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Create New Event
          </Link>
          <Link
            href="/organizer/events"
            className="border border-primary text-primary px-6 py-3 rounded-lg font-medium hover:bg-primary/5 transition-colors"
          >
            Manage Events
          </Link>
        </div>
      </div>
    </div>
  );
}


