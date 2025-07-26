import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../../services/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";

// Helper function to generate consistent class names for tabs
const getTabClassName = (activeTab, tabName) =>
  `flex-1 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
    activeTab === tabName
      ? "border-blue-500 text-blue-600"
      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
  }`;

export default function AdminDashboard() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [rides, setRides] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [activeTab, setActiveTab] = useState("users");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [userStatus, setUserStatus] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setMyProfile(profile);

      if (profile?.role === "admin") {
        let usersQuery = supabase
          .from("profiles")
          .select("*, rides(count)")
          .order("created_at", { ascending: false });

        let ridesQuery = supabase
          .from("rides")
          .select("*, profiles(name, email, gender, phone)")
          .order("created_at", { ascending: false });

        let logsQuery = supabase
          .from("audit_logs")
          .select(
            `
            *,
            profiles:user_id(
              name,
              email
            ),
            target_profiles:target_user_id(
              name,
              email
            )
          `
          )
          .order("created_at", { ascending: false })
          .limit(100);

        // Apply date filters if set
        if (startDate) {
          usersQuery = usersQuery.gte("created_at", startDate);
          ridesQuery = ridesQuery.gte("created_at", startDate);
          logsQuery = logsQuery.gte("created_at", startDate);
        }
        if (endDate) {
          usersQuery = usersQuery.lte("created_at", endDate);
          ridesQuery = ridesQuery.lte("created_at", endDate);
          logsQuery = logsQuery.lte("created_at", endDate);
        }

        const [{ data: usersData }, { data: ridesData }, { data: logsData }] =
          await Promise.all([usersQuery, ridesQuery, logsQuery]);

        setUsers(usersData || []);
        setRides(ridesData || []);
        setAuditLogs(logsData || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDataCallback = useCallback(fetchData, [
    user?.id,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    fetchDataCallback();
  }, [fetchDataCallback]);

  const addAuditLog = async (action, details, targetUserId = null) => {
    try {
      const { error } = await supabase.from("audit_logs").insert({
        user_id: user.id,
        target_user_id: targetUserId,
        action,
        details,
        created_at: new Date().toISOString(),
        ip_address: window.location.hostname,
        user_agent: navigator.userAgent,
      });

      if (error) {
        throw error;
      }

      // Refresh audit logs after adding new entry
      const { data: logsData } = await supabase
        .from("audit_logs")
        .select(
          `
          *,
          profiles:user_id(name, email),
          target_profiles:target_user_id(name, email)
        `
        )
        .order("created_at", { ascending: false })
        .limit(100);

      setAuditLogs(logsData || []);
    } catch (error) {
      console.error("Error adding audit log:", error);
      // Optionally show error to user
      // setError("Failed to log action. Please try again.");
    }
  };

  const deleteUser = async (userId) => {
    try {
      const userToDelete = users.find((u) => u.user_id === userId);
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;

      setUsers(users.filter((u) => u.user_id !== userId));
      await addAuditLog(
        "delete_user",
        `Admin ${user.email} deleted user ${userToDelete?.email || userId}`,
        userId
      );
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const deleteRide = async (id) => {
    try {
      const rideToDelete = rides.find((r) => r.id === id);
      // Get the profile first to ensure we have the correct user_id
      const { data: rideProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", rideToDelete?.user_id)
        .single();

      const { error } = await supabase.from("rides").delete().eq("id", id);

      if (error) throw error;

      setRides(rides.filter((r) => r.id !== id));
      await addAuditLog(
        "delete_ride",
        `Deleted ride from ${rideToDelete?.from || ""} to ${
          rideToDelete?.to || ""
        } (ID: ${id})`,
        rideProfile?.user_id
      );
    } catch (error) {
      console.error("Error deleting ride:", error);
    }
  };

  const blockUser = async (userId) => {
    try {
      const userToBlock = users.find((u) => u.user_id === userId);
      const { error } = await supabase
        .from("profiles")
        .update({ status: "blocked", updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      if (error) throw error;

      setUsers(
        users.map((u) =>
          u.user_id === userId ? { ...u, status: "blocked" } : u
        )
      );
      await addAuditLog(
        "block_user",
        `Admin ${user.email} blocked user ${userToBlock?.email || userId}`,
        userId
      );
    } catch (error) {
      console.error("Error blocking user:", error);
    }
  };

  const unblockUser = async (userId) => {
    try {
      const userToUnblock = users.find((u) => u.user_id === userId);
      const { error } = await supabase
        .from("profiles")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      if (error) throw error;

      setUsers(
        users.map((u) =>
          u.user_id === userId ? { ...u, status: "active" } : u
        )
      );
      await addAuditLog(
        "unblock_user",
        `Admin ${user.email} unblocked user ${userToUnblock?.email || userId}`,
        userId
      );
    } catch (error) {
      console.error("Error unblocking user:", error);
    }
  };

  const filteredUsers = users.filter((user) => {
    if (userStatus !== "all" && user.status !== userStatus) return false;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        user.name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const filteredRides = rides.filter((ride) => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        ride.from?.toLowerCase().includes(searchLower) ||
        ride.to?.toLowerCase().includes(searchLower) ||
        ride.profiles?.name?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  if (!myProfile || myProfile.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 text-red-800 px-4 py-3 rounded-lg">
          Not authorized to access admin dashboard
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto mt-10 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Admin Dashboard</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                fetchData();
              }}
              className="px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <span>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                fetchData();
              }}
              className="px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
          {activeTab === "users" && (
            <select
              value={userStatus}
              onChange={(e) => setUserStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
            </select>
          )}
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab("users")}
              className={getTabClassName(activeTab, "users")}
            >
              Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab("rides")}
              className={getTabClassName(activeTab, "rides")}
            >
              Rides ({rides.length})
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={getTabClassName(activeTab, "audit")}
            >
              Audit Log ({auditLogs.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "users" && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rides
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((u) => (
                    <tr key={u.user_id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {u.name}
                          </div>
                          <div className="text-sm text-gray-500">{u.email}</div>
                          <div className="text-sm text-gray-500">
                            {u.phone || "No phone"}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            u.status === "blocked"
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {u.status || "active"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {u.rides ? u.rides.length : 0} rides
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {u.status === "blocked" ? (
                          <button
                            onClick={() => unblockUser(u.user_id)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            Unblock
                          </button>
                        ) : (
                          <button
                            onClick={() => blockUser(u.user_id)}
                            className="text-yellow-600 hover:text-yellow-900 mr-4"
                          >
                            Block
                          </button>
                        )}
                        <button
                          onClick={() => deleteUser(u.user_id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "rides" && (
            <div className="space-y-4">
              {filteredRides.map((r) => (
                <div key={r.id} className="bg-white shadow rounded-lg p-6">
                  <div className="flex justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <svg
                          className="h-5 w-5 text-gray-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span className="text-lg font-medium">
                          {r.from} → {r.to}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <svg
                          className="h-5 w-5 text-gray-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="text-gray-600">
                          {r.time
                            ? new Date(r.time).toLocaleString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              })
                            : "Time not set"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <svg
                          className="h-5 w-5 text-gray-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        <span className="text-gray-600">
                          Posted by: {r.profiles?.name || "Unknown"}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteRide(r.id)}
                      className="flex items-center space-x-2 text-red-600 hover:text-red-900"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "audit" && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {log.profiles?.name || "System"}
                        </div>
                        <div className="text-sm text-gray-500">
                          {log.profiles?.email}
                        </div>
                        {log.target_profiles && (
                          <div className="mt-1 text-xs text-gray-500">
                            Target: {log.target_profiles.name} (
                            {log.target_profiles.email})
                          </div>
                        )}
                        {log.target_rides && (
                          <div className="mt-1 text-xs text-gray-500">
                            Ride: {log.target_rides.from} →{" "}
                            {log.target_rides.to}
                            {log.target_rides.time && (
                              <span>
                                {" "}
                                (
                                {new Date(
                                  log.target_rides.time
                                ).toLocaleDateString()}
                                )
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {log.details}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
