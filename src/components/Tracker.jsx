import { useEffect, useState } from "react";
import { database, analytics } from "../firebase.jsx";
import { ref, set, get, update, remove, increment, onValue } from "firebase/database";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

const Tracker = () => {
    const [uniqueUserId, setUniqueUserId] = useState(null);
    const today = new Date().toISOString().split("T")[0];
    const currentVisitId = Date.now().toString(36);
    let isVisitActive = false;

    useEffect(() => {
        const initTracking = async () => {
            try {
                console.log("Initializing tracking...");

                // Load FingerprintJS and get unique user ID
                const fp = await FingerprintJS.load();
                const result = await fp.get();
                const visitorId = result.visitorId;
                setUniqueUserId(visitorId);
                console.log("Unique browser fingerprint:", visitorId);

                // Function to fetch user location
                const getUserLocation = async () => {
                    try {
                        console.log("Fetching location data...");
                        const ipResponse = await fetch("https://api.ipify.org?format=json");
                        const ipData = await ipResponse.json();
                        console.log("User IP:", ipData.ip);

                        const geoResponse = await fetch(`https://ipapi.co/${ipData.ip}/json/`);
                        const locationData = await geoResponse.json();

                        if (locationData.error) {
                            throw new Error("Location API error: " + locationData.reason);
                        }

                        console.log("Location Data:", locationData);

                        return {
                            country: locationData.country_name || "Unknown",
                            region: locationData.region || "Unknown",
                            city: locationData.city || "Unknown",
                            latitude: locationData.latitude || "Unknown",
                            longitude: locationData.longitude || "Unknown",
                            ip: ipData.ip
                        };
                    } catch (error) {
                        console.error("Error getting location:", error);
                        return {
                            country: "Unknown",
                            region: "Unknown",
                            city: "Unknown",
                            latitude: "Unknown",
                            longitude: "Unknown",
                            ip: "Unknown"
                        };
                    }
                };

                // Get location data
                const locationData = await getUserLocation();

                // Reference to unique users in Firebase
                const userRef = ref(database, `unique-users/${today}/${visitorId}`);
                const userSnapshot = await get(userRef);

                // Get the current Firebase visit count
                let currentVisits = 0;
                if (userSnapshot.exists()) {
                    currentVisits = userSnapshot.val().visits || 0;
                }

                if (!userSnapshot.exists()) {
                    // First visit ever - create a new entry in unique-users
                    console.log("First visit ever - creating new entry");
                    await set(userRef, {
                        lastSeen: Date.now(),
                        visits: 1,
                        location: locationData
                    });
                } else {
                    // Check if this is a new browser session
                    const sessionRef = ref(database, `active-sessions/${today}/${visitorId}`);
                    const sessionSnapshot = await get(sessionRef);
                    
                    if (!sessionSnapshot.exists()) {
                        // New session - increment visit count
                        console.log("New session - incrementing visit count");
                        await update(userRef, {
                            visits: currentVisits + 1,
                            lastSeen: Date.now()
                        });
                        
                        // Mark this session as active
                        await set(sessionRef, {
                            startTime: Date.now()
                        });
                    } else {
                        // Existing session - just update last seen time
                        console.log("Existing session - updating last seen time");
                        await update(userRef, {
                            lastSeen: Date.now()
                        });
                    }

                    // Clean up session on page unload
                    window.addEventListener("beforeunload", async () => {
                        await remove(sessionRef);
                    });
                }

                // Reference to current visit
                const visitRef = ref(database, `visits/${today}/${currentVisitId}`);

                // Function to start a visit
                const startVisit = async () => {
                    if (!isVisitActive) {
                        isVisitActive = true;
                        console.log("Starting visit tracking...");

                        await set(visitRef, {
                            userId: visitorId,
                            timestamp: Date.now(),
                            active: true,
                            location: locationData
                        });
                    }
                };

                // Function to end a visit
                const endVisit = async () => {
                    if (isVisitActive) {
                        isVisitActive = false;
                        console.log("Ending visit tracking...");
                        await remove(visitRef);
                    }
                };

                // Start visit immediately when the page loads
                await startVisit();

                // Handle tab visibility changes
                const handleVisibilityChange = async () => {
                    if (document.visibilityState === "visible") {
                        // Tab became visible - start visit
                        await startVisit();
                    } else if (document.visibilityState === "hidden") {
                        // Tab hidden - end visit
                        await endVisit();
                    }
                };

                // Add visibility change listener
                document.addEventListener("visibilitychange", handleVisibilityChange);

                // Cleanup visit when user leaves the page
                window.addEventListener("beforeunload", async () => {
                    await endVisit();
                });

                // Listen for unique users count
                onValue(ref(database, `unique-users/${today}`), (snapshot) => {
                    const data = snapshot.val();
                    const uniqueCount = data ? Object.keys(data).length : 0;
                    console.log(`Total Unique Users Today: ${uniqueCount}`);
                });

                // Track page views
                analytics.logEvent('page_view', {
                    page_title: document.title,
                    page_location: window.location.href,
                    user_id: visitorId
                });

                // Track user engagement
                let sessionStartTime = Date.now();

                // Track session duration
                setInterval(() => {
                    const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000);
                    analytics.logEvent('user_engagement', {
                        engagement_time: sessionDuration,
                        type: 'user',
                        user_id: visitorId
                    });
                }, 60000); // Log every minute

                // Track GEE app interactions
                window.addEventListener('message', function (event) {
                    if (event.data && event.data.type === 'analytics') {
                        analytics.logEvent('gee_interaction', {
                            action: event.data.action,
                            category: event.data.category,
                            label: event.data.label || '',
                            user_id: visitorId
                        });
                    }
                });

            } catch (error) {
                console.error("Error initializing tracking:", error);
            }
        };

        initTracking();
    }, []);

    return <p>User Tracking Initialized</p>;
};

export default Tracker;