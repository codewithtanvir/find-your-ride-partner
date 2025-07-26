import React, { useState } from "react";
import { supabase } from "../../services/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";

export default function ProfileSetup({ onDone }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [error, setError] = useState("");

  // Load existing profile data if available
  React.useEffect(() => {
    async function loadProfile() {
      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (data && !error) {
          setName(data.name || "");
          setGender(data.gender || "");
          setWhatsapp(data.whatsapp || "");
        }
      }
    }
    loadProfile();
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");

    try {
      if (!name || !gender || !whatsapp) {
        setError("All fields required");
        return;
      }

      let avatar_url = null;
      if (avatar) {
        // Validate file size (10MB max)
        if (avatar.size > 10 * 1024 * 1024) {
          setError("File size too large. Maximum size is 10MB");
          return;
        }

        // Validate file type
        if (!avatar.type.startsWith("image/")) {
          setError("Only image files are allowed");
          return;
        }

        const fileExt = avatar.name.split(".").pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;

        // Upload to avatars bucket
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, avatar, {
            upsert: true,
            contentType: avatar.type,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          setError("Error uploading image. Please try again.");
          return;
        }

        // Get public URL
        const { data } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);

        avatar_url = data.publicUrl;
      }

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          user_id: user.id,
          name,
          gender,
          whatsapp,
          avatar_url,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
          ignoreDuplicates: false,
        }
      );

      if (profileError) {
        throw profileError;
      }

      onDone();
    } catch (error) {
      console.error("Profile update error:", error);
      setError(error.message || "Error updating profile. Please try again.");
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <form
          onSubmit={handleSave}
          className="bg-white rounded-xl shadow-lg p-8 space-y-6"
        >
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">Profile Setup</h2>
            <p className="mt-2 text-sm text-gray-600">
              Complete your profile to start sharing rides
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 
                         focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label
                htmlFor="gender"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Gender
              </label>
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
                         focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required
              >
                <option value="">Select your gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="whatsapp"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                WhatsApp Number
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">+</span>
                <input
                  id="whatsapp"
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="appearance-none block w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 
                           focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  required
                  placeholder="Enter your WhatsApp number"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Profile Picture
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-green-500 transition-colors duration-200">
                <div className="space-y-1 text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="avatar"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-green-500"
                    >
                      <span>Upload a file</span>
                      <input
                        id="avatar"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setAvatar(e.target.files[0])}
                        className="sr-only"
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
                </div>
              </div>
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
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                     bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 
                     transition-colors duration-200"
          >
            Save Profile
          </button>
        </form>
      </div>
    </div>
  );
}
