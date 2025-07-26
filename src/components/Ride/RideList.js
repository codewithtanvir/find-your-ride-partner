import React, { useEffect, useState } from "react";
import { supabase } from "../../services/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";

// Local Storage keys
const CACHE_KEYS = {
  RIDES: "cached_rides",
  LAST_FETCH: "last_fetch_time",
  PROFILE: "cached_profile",
};

// Cache expiration time (15 minutes)
const CACHE_EXPIRATION = 15 * 60 * 1000;

const isTimeWithinRange = (time1, time2, rangeInMinutes = 30) => {
  const t1 = new Date(time1);
  const t2 = new Date(time2);
  const diffInMinutes = Math.abs(t1 - t2) / (1000 * 60);
  return diffInMinutes <= rangeInMinutes;
};

const isSameDay = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

export default function RideList() {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Add online/offline event listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Function to check if cache is valid
  const isCacheValid = () => {
    const lastFetchTime = localStorage.getItem(CACHE_KEYS.LAST_FETCH);
    return (
      lastFetchTime && Date.now() - Number(lastFetchTime) < CACHE_EXPIRATION
    );
  };

  // Function to get cached data
  const getCachedData = () => {
    try {
      const cachedRides = JSON.parse(localStorage.getItem(CACHE_KEYS.RIDES));
      const cachedProfile = JSON.parse(
        localStorage.getItem(CACHE_KEYS.PROFILE)
      );
      return { rides: cachedRides, profile: cachedProfile };
    } catch (error) {
      console.error("Error reading from cache:", error);
      return { rides: null, profile: null };
    }
  };

  // Function to set cache data
  const setCacheData = (rides, profile) => {
    try {
      localStorage.setItem(CACHE_KEYS.RIDES, JSON.stringify(rides));
      localStorage.setItem(CACHE_KEYS.PROFILE, JSON.stringify(profile));
      localStorage.setItem(CACHE_KEYS.LAST_FETCH, Date.now().toString());
    } catch (error) {
      console.error("Error setting cache:", error);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // Check cache first
        if (isCacheValid()) {
          const { rides: cachedRides, profile: cachedProfile } =
            getCachedData();
          if (cachedRides && cachedProfile) {
            setRides(cachedRides);
            setLoading(false);
            return;
          }
        }

        // Get my profile
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (profileError || !profile) {
          console.error("Error fetching profile:", profileError);
          return;
        }

        // Only fetch rides if we have a profile with gender
        if (profile.gender) {
          const { data: myRides } = await supabase
            .from("rides")
            .select("time, from, to")
            .eq("user_id", user.id);

          const { data: rides, error: ridesError } = await supabase
            .from("rides")
            .select(
              `
              *,
              profiles (
                name,
                whatsapp,
                email,
                avatar_url,
                gender
              )
            `
            )
            .eq("gender", profile.gender)
            .neq("user_id", user.id);

          if (ridesError) {
            console.error("Error fetching rides:", ridesError);
            return;
          }

          // Process and filter rides based on matching criteria
          const matchedRides = (rides || []).filter((ride) => {
            // Check if there's a matching ride posted by the user
            return (myRides || []).some((myRide) => {
              // Check if routes match
              const routeMatches =
                myRide.from.toLowerCase() === ride.from.toLowerCase() &&
                myRide.to.toLowerCase() === ride.to.toLowerCase();

              // Check if it's the same day and within ±30 minutes
              const sameDay = isSameDay(myRide.time, ride.time);
              const timeMatches = isTimeWithinRange(myRide.time, ride.time);

              return routeMatches && sameDay && timeMatches;
            });
          });

          // Sort matches by time proximity
          const sortedRides = matchedRides.sort(
            (a, b) =>
              Math.abs(new Date(a.time) - new Date()) -
              Math.abs(new Date(b.time) - new Date())
          );

          // Update cache
          setCacheData(sortedRides, profile);
          setRides(sortedRides || []);
        }
      } catch (error) {
        console.error("Error in fetchData:", error);

        // If online fetch fails, try to use cached data as fallback
        const { rides: cachedRides } = getCachedData();
        if (cachedRides) {
          setRides(cachedRides);
        }
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchData();
    }
  }, [user]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
          Find a Ride Partner
        </h2>
        <div className="flex items-center space-x-2">
          {!isOnline && (
            <div className="flex items-center space-x-2">
              <span className="flex items-center text-yellow-600 text-sm bg-yellow-50 px-2 py-1 rounded-full">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
                Offline
              </span>
              <span className="hidden sm:inline text-sm text-gray-500">
                Using cached data
              </span>
            </div>
          )}
          <button
            onClick={() => {
              if (isOnline) {
                // If online, clear cache and reload data
                localStorage.removeItem(CACHE_KEYS.LAST_FETCH);
                localStorage.removeItem(CACHE_KEYS.RIDES);
                localStorage.removeItem(CACHE_KEYS.PROFILE);
                window.location.reload();
              } else {
                // If offline, show cached data
                const { rides: cachedRides } = getCachedData();
                if (cachedRides) {
                  setRides(cachedRides);
                }
              }
            }}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors duration-200"
            aria-label="Refresh"
            title={isOnline ? "Refresh data" : "Show cached data"}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : rides.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          {!isOnline ? (
            <>
              <svg
                className="mx-auto h-12 w-12 text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                You're offline
              </h3>
              <p className="mt-2 text-gray-500">
                No cached ride matches available. Connect to the internet to
                find new matches. Your previous ride matches will be saved for
                offline viewing.
              </p>
            </>
          ) : (
            <>
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                No matches found
              </h3>
              <p className="mt-2 text-gray-500">
                We couldn't find any ride partners matching your criteria at the
                moment. Try posting a ride to find matches!
              </p>
            </>
          )}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {rides.map((ride) => (
          <div
            key={ride.id}
            className="bg-white shadow-sm hover:shadow-md transition-shadow duration-200 rounded-lg p-4 sm:p-6 border border-gray-100"
          >
            <div className="flex items-center mb-4">
              <div className="relative w-12 h-12">
                {ride.profiles?.avatar_url ? (
                  <img
                    src={ride.profiles.avatar_url}
                    alt={ride.profiles.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-lg font-semibold">
                      {ride.profiles?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-100 border-2 border-white rounded-full flex items-center justify-center">
                  <span className="text-xs text-green-800">
                    {ride.profiles?.gender?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="ml-3 flex-grow">
                <h3 className="font-semibold text-gray-900">
                  {ride.profiles?.name}
                </h3>
                <div className="flex items-center space-x-2">
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm text-gray-500">
                    {new Date(ride.time).toLocaleString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3 mb-4">
              <div className="flex items-center text-gray-700">
                <svg
                  className="w-5 h-5 mr-2 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <div>
                  <div className="font-medium">{ride.from}</div>
                  <div className="flex items-center text-gray-500">
                    <svg
                      className="w-4 h-4 mx-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                  </div>
                  <div className="font-medium">{ride.to}</div>
                </div>
              </div>
            </div>
            <div className="flex space-x-3">
              <a
                href={`https://wa.me/${ride.profiles?.whatsapp?.replace(
                  /\D/g,
                  ""
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center bg-green-500 hover:bg-green-600 active:bg-green-700 text-white py-3 px-4 rounded-md text-sm font-medium transition-colors duration-200 touch-action-manipulation"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                <span className="sm:inline">WhatsApp</span>
              </a>
              <a
                href={`mailto:${ride.profiles?.email}`}
                className="flex-1 inline-flex items-center justify-center bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white py-3 px-4 rounded-md text-sm font-medium transition-colors duration-200 touch-action-manipulation"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <span className="sm:inline">Email</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
