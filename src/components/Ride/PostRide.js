import React, { useState } from "react";
import { supabase } from "../../services/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";

export default function PostRide({ onPosted }) {
  const { user } = useAuth();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");

  const handlePost = async (e) => {
    e.preventDefault();
    if (!from || !to || !date || !time) {
      setError("All fields required");
      return;
    }

    // Validate if the selected date and time is in the future
    const selectedDateTime = new Date(`${date}T${time}`);
    if (selectedDateTime < new Date()) {
      setError("Please select a future date and time");
      return;
    }

    // Combine date and time for database
    const datetime = selectedDateTime.toISOString();
    // Get user gender from profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("gender")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      setError("Error fetching profile. Please try again.");
      return;
    }

    if (!profile?.gender) {
      setError("Please complete your profile setup first.");
      return;
    }

    const { error } = await supabase.from("rides").insert({
      user_id: user.id,
      from,
      to,
      time: datetime,
      gender: profile.gender,
    });
    if (error) setError(error.message);
    else onPosted();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <form
        onSubmit={handlePost}
        className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 space-y-6"
      >
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Post a Ride</h2>
          <p className="mt-2 text-sm text-gray-600">
            Share your journey with others
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="from"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Pickup Location
            </label>
            <select
              id="from"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            >
              <option value="">Select pickup location</option>
              <option value="Campus">Campus</option>
              <option value="Kuril">Kuril</option>
              <option value="Future Park">Future Park</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="to"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Drop Location
            </label>
            <select
              id="to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            >
              <option value="">Select drop location</option>
              <option value="Campus">Campus</option>
              <option value="Kuril">Kuril</option>
              <option value="Future Park">Future Park</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="date"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Departure Date
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            />
          </div>

          <div>
            <label
              htmlFor="time"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Departure Time
            </label>
            <input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
        >
          Post Ride
        </button>
      </form>
    </div>
  );
}
