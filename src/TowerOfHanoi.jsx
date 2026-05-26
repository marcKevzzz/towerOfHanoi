import React, { useState, useEffect, useRef, useCallback } from "react";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";

export default function TowerOfHanoi() {
  const [disks, setDisks] = useState(3);
  const [towers, setTowers] = useState([[3, 2, 1], [], []]);
  const [selectedTower, setSelectedTower] = useState(null);
  const [moves, setMoves] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [minMoves, setMinMoves] = useState(7);
  const [darkMode, setDarkMode] = useState(true);
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef(null);
  const towerRefs = useRef([]);
  const [shakeTower, setShakeTower] = useState(null);
  const [toast, setToast] = useState(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = useCallback((message) => {
    setToast({ message, id: Date.now() });
  }, []);

  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem("hanoiStats_v2");
    if (saved) return JSON.parse(saved);

    // Legacy migration
    const legacySaved = localStorage.getItem("hanoiStats");
    const initialStats = {};
    [3, 4, 5, 6, 7].forEach((d) => {
      initialStats[d] = {
        gamesCompleted: 0,
        bestTime: null,
        fewestMoves: null,
        totalTime: 0,
      };
    });

    if (legacySaved) {
      try {
        const legacy = JSON.parse(legacySaved);
        const lastD = legacy.lastDisks || 3;
        initialStats[lastD] = {
          gamesCompleted: legacy.gamesCompleted || 0,
          bestTime: legacy.bestTime || null,
          fewestMoves: legacy.fewestMoves || null,
          totalTime: legacy.totalTime || 0,
        };
      } catch (e) {
        console.error("Migration error:", e);
      }
    }
    return initialStats;
  });

  const [username, setUsername] = useState(() => {
    return localStorage.getItem("hanoi_username") || "";
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState(null);
  const [activeTab, setActiveTab] = useState("stats"); // "stats" or "leaderboard"
  const [confetti, setConfetti] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [autoResetCountdown, setAutoResetCountdown] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Supabase Configuration from Vite environment
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

  // Minimum moves formula
  useEffect(() => setMinMoves(Math.pow(2, disks) - 1), [disks]);

  // Reset pagination page on tab or disk count change
  useEffect(() => {
    setCurrentPage(1);
  }, [disks, activeTab]);

  // Confetti effect on completion
  useEffect(() => {
    if (isComplete) {
      const pieces = Array.from({ length: 80 }, (_, i) => ({
        id: i,
        x: Math.random() * 100, // percentage width
        y: -10 - Math.random() * 20, // initial height
        size: Math.random() * 6 + 6,
        color: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"][Math.floor(Math.random() * 6)],
        delay: Math.random() * 0.6,
        duration: Math.random() * 2.5 + 2,
        rotation: Math.random() * 360,
        drift: Math.random() * 40 - 20,
      }));
      setConfetti(pieces);
    } else {
      setConfetti([]);
      setHasSubmitted(false); // Reset submit state when a new game starts
    }
  }, [isComplete]);

  // Online leaderboard fetching with 1-hour caching
  const fetchLeaderboard = useCallback(async (force = false) => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setLeaderboardError("Database not configured.");
      setLeaderboardLoading(false);
      return;
    }

    setLeaderboardLoading(true);
    setLeaderboardError(null);

    const processData = (rawList) => {
      const uniquePlayers = {};
      rawList.forEach((row) => {
        const user = row.username.trim().toLowerCase();
        const existing = uniquePlayers[user];
        if (
          !existing ||
          row.moves < existing.moves ||
          (row.moves === existing.moves && row.time < existing.time)
        ) {
          uniquePlayers[user] = row;
        }
      });
      return Object.values(uniquePlayers).sort((a, b) => {
        if (a.moves !== b.moves) return a.moves - b.moves;
        return a.time - b.time;
      });
    };

    const cacheKey = `hanoi_leaderboard_cache_${disks}`;
    if (!force) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 3600000) { // 1 hour in ms
            setLeaderboardData(processData(data));
            setLeaderboardLoading(false);
            return;
          }
        } catch {
          console.error("Cache read error");
        }
      }
    }

    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/leaderboard?disk_count=eq.${disks}&order=moves.asc,time.asc&limit=100`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch leaderboard.");

      const data = await response.json();
      const processed = processData(data);
      setLeaderboardData(processed);
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ data: processed, timestamp: Date.now() })
      );
    } catch (err) {
      setLeaderboardError(err.message);
      // Fallback to expired cache if offline
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { data } = JSON.parse(cached);
          setLeaderboardData(processData(data));
        } catch { /* ignore fallback load error */ }
      }
    } finally {
      setLeaderboardLoading(false);
    }
  }, [disks, SUPABASE_URL, SUPABASE_ANON_KEY]);

  useEffect(() => {
    if (activeTab === "leaderboard" && !isSubmitting) {
      fetchLeaderboard();
    }
  }, [activeTab, disks, isSubmitting, fetchLeaderboard]);

  const autoSubmitScore = useCallback(async (nameToSubmit) => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setHasSubmitted(true);
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Check if the user already has records for this disk count
      const checkResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/leaderboard?username=eq.${nameToSubmit}&disk_count=eq.${disks}`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (!checkResponse.ok) throw new Error("Failed to verify existing records.");
      const existingRecords = await checkResponse.json();

      if (existingRecords.length > 0) {
        // Find their absolute best record among any duplicates
        let bestRecord = existingRecords[0];
        for (let i = 1; i < existingRecords.length; i++) {
          const rec = existingRecords[i];
          if (
            rec.moves < bestRecord.moves ||
            (rec.moves === bestRecord.moves && rec.time < bestRecord.time)
          ) {
            bestRecord = rec;
          }
        }

        const isBetter =
          moves < bestRecord.moves ||
          (moves === bestRecord.moves && time < bestRecord.time);

        if (isBetter) {
          // Update the best record to the new score via PATCH
          const updateResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/leaderboard?id=eq.${bestRecord.id}`,
            {
              method: "PATCH",
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                moves: moves,
                time: time,
                created_at: new Date().toISOString(),
              }),
            }
          );

          if (!updateResponse.ok) throw new Error("Failed to update score.");
          showToast("🎉 New personal best submitted automatically!");
        } else {
          showToast("🎉 Game completed! Personal best not beaten.");
        }

        // Clean up legacy duplicate rows for this user & disk size to keep the DB perfectly clean!
        if (existingRecords.length > 1) {
          await fetch(
            `${SUPABASE_URL}/rest/v1/leaderboard?username=eq.${nameToSubmit}&disk_count=eq.${disks}&id=neq.${bestRecord.id}`,
            {
              method: "DELETE",
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
            }
          );
        }
      } else {
        // Insert new record since none exist via POST
        const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/leaderboard`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            username: nameToSubmit,
            disk_count: disks,
            moves: moves,
            time: time,
          }),
        });

        if (!insertResponse.ok) throw new Error("Failed to submit score.");
        showToast("🎉 Score submitted automatically!");
      }

      setHasSubmitted(true);
      fetchLeaderboard(true); // Force refresh leaderboard data & update cache
    } catch {
      showToast("⚠️ Automatic leaderboard submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  }, [disks, moves, time, fetchLeaderboard, showToast, SUPABASE_URL, SUPABASE_ANON_KEY]);

  const submitScore = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    // Save username locally for convenience
    localStorage.setItem("hanoi_username", username.trim());
    await autoSubmitScore(username.trim());
    setShowModal(false); // Hide the victory modal once submitted!
    setActiveTab("leaderboard"); // Switch tab to leaderboard instantly!
  };

  // Automatic submission trigger when game completes
  useEffect(() => {
    if (isComplete) {
      const savedName = localStorage.getItem("hanoi_username");
      if (savedName && savedName.trim()) {
        autoSubmitScore(savedName.trim());
        setActiveTab("leaderboard"); // Switch tab to leaderboard instantly!
      }
    }
  }, [isComplete, autoSubmitScore]);

  // Completion check
  useEffect(() => {
    if (towers[2].length === disks && disks > 0) {
      setIsComplete(true);
      setIsRunning(false);
      clearInterval(timerRef.current);

      const savedName = localStorage.getItem("hanoi_username");
      if (!savedName || !savedName.trim()) {
        setShowModal(true);
      } else {
        setAutoResetCountdown(5);
      }

      setStats((prev) => {
        const currentStats = prev[disks] || {
          gamesCompleted: 0,
          bestTime: null,
          fewestMoves: null,
          totalTime: 0,
        };

        const newBestTime =
          currentStats.bestTime === null || time < currentStats.bestTime
            ? time
            : currentStats.bestTime;

        const newFewestMoves =
          currentStats.fewestMoves === null || moves < currentStats.fewestMoves
            ? moves
            : currentStats.fewestMoves;

        return {
          ...prev,
          [disks]: {
            gamesCompleted: currentStats.gamesCompleted + 1,
            bestTime: newBestTime,
            fewestMoves: newFewestMoves,
            totalTime: currentStats.totalTime + time,
          },
        };
      });
    }
  }, [towers, disks]);

  // Timer
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => setTime((t) => t + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning]);

  useEffect(() => {
    localStorage.setItem("hanoiStats_v2", JSON.stringify(stats));
  }, [stats]);

  const resetGame = (numDisks = disks) => {
    const newTowers = [
      Array.from({ length: numDisks }, (_, i) => numDisks - i),
      [],
      [],
    ];
    setTowers(newTowers);
    setMoves(0);
    setIsComplete(false);
    setShowModal(false);
    setSelectedTower(null);
    setDisks(numDisks);
    setTime(0);
    setIsRunning(false);
    setAutoResetCountdown(null); // Clear auto-reset countdown!
  };

  // Auto-reset countdown timer tick
  useEffect(() => {
    if (autoResetCountdown === null) return;
    if (autoResetCountdown <= 0) {
      resetGame();
      setAutoResetCountdown(null);
      return;
    }

    const timer = setTimeout(() => {
      setAutoResetCountdown((c) => c - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [autoResetCountdown]);

  const executeMove = useCallback((fromIndex, toIndex) => {
    if (fromIndex === toIndex) {
      setSelectedTower(null);
      return;
    }

    if (!isRunning && moves === 0) setIsRunning(true);

    const fromTower = towers[fromIndex];
    const toTower = towers[toIndex];
    const disk = fromTower[fromTower.length - 1];

    if (toTower.length === 0 || disk < toTower[toTower.length - 1]) {
      const newTowers = towers.map((t, idx) => {
        if (idx === fromIndex) return t.slice(0, -1);
        if (idx === toIndex) return [...t, disk];
        return t;
      });
      setTowers(newTowers);
      setMoves((m) => m + 1);
      setSelectedTower(null);
    } else {
      // Invalid move! Trigger shake, show warning toast, and switch selection
      setShakeTower(toIndex);
      setTimeout(() => setShakeTower(null), 500);
      showToast("A larger disk cannot be placed on top of a smaller disk!");
      setSelectedTower(toIndex);
    }
  }, [towers, isRunning, moves, showToast]);

  const handleTowerClick = (towerIndex) => {
    if (isComplete) return;

    if (selectedTower === null) {
      if (towers[towerIndex].length > 0) setSelectedTower(towerIndex);
    } else {
      if (selectedTower === towerIndex) setSelectedTower(null);
      else {
        executeMove(selectedTower, towerIndex);
      }
    }
  };

  const handleDragEnd = (event, info, fromTowerIndex) => {
    // Convert page-relative drag point to viewport-relative coordinate by subtracting horizontal scroll
    const x = info.point.x - window.scrollX;
    
    // Direct DOM query is 100% robust against React ref lifecycle delays
    const towerElements = document.querySelectorAll(".tower-column");
    
    let targetTowerIndex = null;
    let minDistance = Infinity;
    
    towerElements.forEach((el, idx) => {
      const rect = el.getBoundingClientRect();
      // Calculate center of the tower column in viewport coordinates
      const towerCenterX = rect.left + rect.width / 2;
      const distance = Math.abs(x - towerCenterX);
      
      // We want to snap to the closest tower column
      if (distance < minDistance) {
        minDistance = distance;
        targetTowerIndex = idx;
      }
    });

    if (targetTowerIndex !== null) {
      executeMove(fromTowerIndex, targetTowerIndex);
    } else {
      setSelectedTower(null);
    }
  };

  const getDiskColor = (size) => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-red-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
    ];
    return colors[size - 1] || "bg-gray-500";
  };

  const getDiskWidth = (size) => size * 40;
  const formatTime = (s) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(leaderboardData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedData = leaderboardData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 ${
        darkMode
          ? "bg-gradient-to-br from-slate-900 to-slate-800"
          : "bg-gradient-to-br from-blue-50 to-indigo-100"
      } transition-colors duration-500 select-none`}
    >
      {/* Pure Framer Motion Confetti Particle System */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
        {confetti.map((c) => (
          <motion.div
            key={c.id}
            initial={{ y: `${c.y}vh`, x: `${c.x}vw`, rotate: c.rotation, opacity: 1 }}
            animate={{
              y: "110vh",
              x: `${c.x + c.drift}vw`,
              rotate: c.rotation + 720,
              opacity: [1, 1, 0.8, 0],
            }}
            transition={{
              duration: c.duration,
              delay: c.delay,
              ease: "linear",
            }}
            className="absolute rounded-sm"
            style={{
              width: c.size,
              height: c.size * 1.5,
              backgroundColor: c.color,
            }}
          />
        ))}
      </div>

      <div className="max-w-6xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-4 mb-4 flex-wrap">
            <h1
              className={`text-5xl font-bold ${
                darkMode ? "text-white" : "text-slate-900"
              }`}
            >
              Tower of Hanoi
            </h1>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-3 rounded-lg ${
                darkMode
                  ? "bg-slate-700 text-yellow-400"
                  : "bg-white text-slate-700 shadow-md"
              } hover:scale-110 transition`}
            >
              {darkMode ? "☀️" : "🌙"}
            </button>
          </div>
          <p
            className={`${
              darkMode ? "text-slate-300" : "text-slate-600"
            } text-lg`}
          >
            Move all disks to the rightmost tower
          </p>
        </div>

        {/* Stats */}
        <div
          className={`${
            darkMode ? "bg-slate-800" : "bg-white shadow-xl"
          } rounded-xl p-6 mb-6`}
        >
          <div className="flex flex-wrap justify-between items-center text-center gap-4">
            <div className={`${darkMode ? "text-white" : "text-slate-900"}`}>
              <span className="text-xl font-semibold">Moves: </span>
              <span
                className={`${
                  darkMode ? "text-blue-400" : "text-blue-600"
                } font-bold`}
              >
                {moves}
              </span>
              <span className="ml-3 text-sm opacity-70">(Min: {minMoves})</span>
            </div>
            <div
              className={`${
                darkMode ? "text-white" : "text-slate-900"
              } text-lg`}
            >
              ⏱ {formatTime(time)}
            </div>
          </div>
        </div>

        {/* Inline Victory Celebration (when modal is not shown) */}
        <AnimatePresence>
          {isComplete && !showModal && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -20 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-6 text-center text-emerald-400 font-bold text-lg flex flex-col sm:flex-row items-center justify-center gap-3 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2">
                <span>🏆</span>
                <span>Victory! Completed in {moves} moves in {formatTime(time)}!</span>
              </div>
              <span className="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full font-medium">
                {isSubmitting ? "Submitting..." : hasSubmitted ? "✅ Score Auto-Submitted" : "Offline Record Saved"}
              </span>
              {autoResetCountdown !== null && (
                <span className="text-xs bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold animate-pulse">
                  🔄 Auto-resetting in {autoResetCountdown}s
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Area */}
        <div className="flex justify-around items-end min-h-[340px] sm:h-[450px] mb-8 gap-2 sm:gap-6 px-2">
          {towers.map((tower, i) => {
            const topDisk = tower[tower.length - 1];
            return (
              <motion.div
                key={i}
                ref={(el) => (towerRefs.current[i] = el)}
                onClick={() => handleTowerClick(i)}
                animate={
                  shakeTower === i
                    ? {
                        x: [0, -10, 10, -10, 10, -5, 5, 0],
                        transition: { duration: 0.4 },
                      }
                    : {}
                }
                className={`tower-column relative flex-1 flex flex-col items-center justify-end cursor-pointer group`}
              >
                {/* Stick */}
                <div className="relative flex flex-col items-center justify-end h-[240px] sm:h-[320px] w-full">
                  {/* Stick base */}
                  <div
                    className={`absolute bottom-0 w-2 sm:w-3 h-52 sm:h-76 ${
                      darkMode ? "bg-slate-600" : "bg-slate-400"
                    } rounded-t-lg z-10 pointer-events-none`}
                  ></div>

                  {/* Disks under stick */}
                  <div className="absolute bottom-0 z-10 flex flex-col-reverse items-center justify-start">
                    <AnimatePresence>
                      {tower.map((disk) => {
                        const isTopDisk = disk === topDisk;
                        const isSelected = selectedTower === i && isTopDisk; // selected tower + top disk

                        return (
                          <div
                            key={disk}
                            className="transition-transform duration-300 ease-out"
                            style={{
                              transform: isSelected ? "translateY(-8px)" : "translateY(0)",
                              zIndex: isSelected ? 30 : 0,
                            }}
                          >
                            <motion.div
                              layout
                              drag={isTopDisk}
                              dragSnapToOrigin={true}
                              dragMomentum={false}
                              whileDrag={{ scale: 1.1, zIndex: 100 }}
                              whileHover={isTopDisk ? { scale: 1.05 } : {}}
                              onDragStart={() => {
                                if (selectedTower !== i) setSelectedTower(i);
                              }}
                              onDragEnd={(e, info) => handleDragEnd(e, info, i)}
                              initial={{ y: 20, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{
                                type: "spring",
                                stiffness: 120,
                                damping: 10,
                              }}
                              className={`h-6 sm:h-9 ${getDiskColor(
                                disk,
                              )} rounded-lg shadow-lg mb-0.5 sm:mb-1 relative z-0 transition-colors duration-300 cursor-pointer
                              ${
                                isTopDisk
                                  ? "hover:brightness-110"
                                  : ""
                              }
                              ${
                                isSelected
                                  ? "brightness-110 ring-2 ring-yellow-400"
                                  : ""
                              }
                              `}
                              style={{
                                width: `clamp(30px, calc(${
                                  getDiskWidth(disk) * 0.075
                                }vw + 40px), 800px)`,
                              }}
                            />
                          </div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* Tower label and base */}
                  <div
                    className={`absolute bottom-[-20px] sm:bottom-[-30px] w-20 md:w-56 h-4 sm:h-5 sm:w-30 ${
                      darkMode ? "bg-slate-700" : "bg-slate-500"
                    } rounded-lg shadow-md pointer-events-none`}
                  ></div>
                </div>
                <div
                  className={`${
                    darkMode ? "text-slate-400" : "text-slate-600"
                  } mt-10 sm:mt-16 text-xs sm:text-sm font-medium`}
                >
                  Tower {i + 1}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          <button
            onClick={() => resetGame()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition"
          >
            🔄 Reset Game
          </button>
          <select
            value={disks}
            onChange={(e) => resetGame(Number(e.target.value))}
            className={`px-6 py-3 rounded-lg border-2 ${
              darkMode
                ? "bg-slate-700 text-white border-slate-600"
                : "bg-white border-slate-300 text-slate-900"
            } shadow-md`}
          >
            {[3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n} Disks
              </option>
            ))}
          </select>
        </div>

        {/* Stats & Leaderboard Dashboard */}
        <div
          className={`rounded-2xl p-6 mb-6 transition-all duration-500 border ${
            darkMode
              ? "bg-slate-800/90 border-slate-700/50 shadow-2xl backdrop-blur-sm"
              : "bg-white border-slate-200 shadow-xl"
          }`}
        >
          {/* Tab Headers */}
          <div className={`flex border-b mb-6 gap-2 ${darkMode ? "border-slate-700/40" : "border-slate-200"}`}>
            <button
              onClick={() => setActiveTab("stats")}
              className={`pb-3 px-4 font-bold text-base transition-all relative ${
                activeTab === "stats"
                  ? darkMode
                    ? "text-blue-400 border-b-2 border-blue-400"
                    : "text-blue-600 border-b-2 border-blue-600"
                  : darkMode
                  ? "text-slate-400 hover:text-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              📊 Player Statistics
            </button>
            <button
              onClick={() => setActiveTab("leaderboard")}
              className={`pb-3 px-4 font-bold text-base transition-all relative ${
                activeTab === "leaderboard"
                  ? darkMode
                    ? "text-blue-400 border-b-2 border-blue-400"
                    : "text-blue-600 border-b-2 border-blue-600"
                  : darkMode
                  ? "text-slate-400 hover:text-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              🏆 Online Leaderboards ({disks} Disks)
            </button>
          </div>

          {activeTab === "stats" ? (
            <div className="space-y-8">
              {/* Selected Disk Count Quick Stats */}
              <div className="text-left">
                <h3 className={`text-sm font-bold mb-4 uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Active View: {disks} Disks Performance
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className={`p-4 rounded-xl border ${darkMode ? "bg-slate-900/50 border-slate-700/30" : "bg-slate-50 border-slate-100"}`}>
                    <p className="text-xs uppercase font-bold text-slate-400 mb-1">Games Completed</p>
                    <p className="text-2xl font-black text-blue-500">{stats[disks]?.gamesCompleted || 0}</p>
                  </div>
                  <div className={`p-4 rounded-xl border ${darkMode ? "bg-slate-900/50 border-slate-700/30" : "bg-slate-50 border-slate-100"}`}>
                    <p className="text-xs uppercase font-bold text-slate-400 mb-1">Fewest Moves</p>
                    <p className="text-2xl font-black text-yellow-500">{stats[disks]?.fewestMoves ?? "--"}</p>
                  </div>
                  <div className={`p-4 rounded-xl border ${darkMode ? "bg-slate-900/50 border-slate-700/30" : "bg-slate-50 border-slate-100"}`}>
                    <p className="text-xs uppercase font-bold text-slate-400 mb-1">Best Time</p>
                    <p className="text-2xl font-black text-emerald-500">
                      {stats[disks]?.bestTime ? formatTime(stats[disks].bestTime) : "--:--"}
                    </p>
                  </div>
                  <div className={`p-4 rounded-xl border ${darkMode ? "bg-slate-900/50 border-slate-700/30" : "bg-slate-50 border-slate-100"}`}>
                    <p className="text-xs uppercase font-bold text-slate-400 mb-1">Total Time Played</p>
                    <p className="text-2xl font-black text-purple-500">
                      {stats[disks]?.totalTime ? formatTime(stats[disks].totalTime) : "--:--"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Comparative Table */}
              <div className="text-left">
                <h3 className={`text-sm font-bold mb-4 uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Comparative Record across All Disk Counts
                </h3>
                <div className={`overflow-x-auto rounded-xl border ${darkMode ? "border-slate-700/50" : "border-slate-200"}`}>
                  <table className="w-full text-sm text-left">
                    <thead className={`${darkMode ? "bg-slate-900/80 text-slate-300" : "bg-slate-100 text-slate-650"} uppercase text-xs font-bold`}>
                      <tr>
                        <th className="px-6 py-4">Size</th>
                        <th className="px-6 py-4 text-center">Completed</th>
                        <th className="px-6 py-4 text-center">Fewest Moves</th>
                        <th className="px-6 py-4 text-center">Best Time</th>
                        <th className="px-6 py-4 text-right">Total Time</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${darkMode ? "divide-slate-700/20" : "divide-slate-200/60"}`}>
                      {[3, 4, 5, 6, 7].map((d) => {
                        const dStats = stats[d] || { gamesCompleted: 0, bestTime: null, fewestMoves: null, totalTime: 0 };
                        const isCurrent = d === disks;
                        return (
                          <tr
                            key={d}
                            className={`transition-colors ${
                              isCurrent
                                ? darkMode
                                  ? "bg-blue-500/10 text-blue-300 font-semibold"
                                  : "bg-blue-50 text-blue-900 font-semibold"
                                : darkMode
                                ? "hover:bg-slate-700/40 text-slate-300"
                                : "hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <td className="px-6 py-4 flex items-center gap-2">
                              <span>🎮 {d} Disks</span>
                              {isCurrent && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">Active</span>}
                            </td>
                            <td className="px-6 py-4 text-center">{dStats.gamesCompleted}</td>
                            <td className="px-6 py-4 text-center font-mono">{dStats.fewestMoves ?? "--"}</td>
                            <td className="px-6 py-4 text-center font-mono">{dStats.bestTime ? formatTime(dStats.bestTime) : "--:--"}</td>
                            <td className="px-6 py-4 text-right font-mono">{formatTime(dStats.totalTime)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-left">
              {/* Leaderboard Fetch States */}
              {!SUPABASE_URL || !SUPABASE_ANON_KEY ? (
                <div className={`p-6 rounded-xl border text-center ${
                  darkMode ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-100"
                }`}>
                  <span className="text-3xl mb-3 block">🔌</span>
                  <h3 className={`text-base font-bold mb-2 ${darkMode ? "text-white" : "text-slate-800"}`}>
                    Online Leaderboard Offline
                  </h3>
                  <p className={`text-xs max-w-md mx-auto mb-4 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    To enable the global online leaderboards, create a Supabase project and define environment variables in your <code className="bg-slate-700/30 px-1.5 py-0.5 rounded text-red-400">.env</code> file:
                  </p>
                  <pre className="text-left text-[11px] font-mono p-3 bg-slate-950 text-emerald-400 rounded-lg max-w-xs md:max-w-md mx-auto overflow-x-auto mb-4 border border-slate-850">
{`VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key`}
                  </pre>
                  <p className={`text-[10px] ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
                    A migration SQL script was generated at <code className="bg-slate-700/30 px-1 py-0.5 rounded text-yellow-400">supabase_migration.sql</code> in the project directory to help set up the table!
                  </p>

                  {/* Local Best fallback list */}
                  <div className={`mt-8 border-t pt-6 ${darkMode ? "border-slate-700/40" : "border-slate-200"}`}>
                    <h4 className={`text-xs uppercase font-bold mb-3 tracking-wide ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Your Personal Record (Local Offline)</h4>
                    {stats[disks]?.gamesCompleted > 0 ? (
                      <div className={`overflow-x-auto rounded-lg border ${darkMode ? "border-slate-700/40" : "border-slate-200"}`}>
                        <table className="w-full text-xs text-left">
                          <thead className={darkMode ? "bg-slate-900/60 text-slate-300" : "bg-slate-100 text-slate-600"}>
                            <tr>
                              <th className="px-4 py-2">Rank</th>
                              <th className="px-4 py-2">Username</th>
                              <th className="px-4 py-2 text-center">Moves</th>
                              <th className="px-4 py-2 text-right">Best Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className={darkMode ? "bg-slate-800/40 text-slate-200" : "bg-white text-slate-700"}>
                              <td className="px-4 py-2 font-bold text-amber-400">🥇 1</td>
                              <td className="px-4 py-2 font-semibold">{username || "Local Player"}</td>
                              <td className="px-4 py-2 text-center font-mono">{stats[disks].fewestMoves}</td>
                              <td className="px-4 py-2 text-right font-mono">{formatTime(stats[disks].bestTime)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No records completed yet for {disks} disks.</p>
                    )}
                  </div>
                </div>
              ) : leaderboardLoading ? (
                <div className="space-y-3 py-6">
                  <div className="h-6 bg-slate-700/25 animate-pulse rounded-md w-full"></div>
                  <div className="h-8 bg-slate-700/20 animate-pulse rounded-md w-full"></div>
                  <div className="h-8 bg-slate-700/15 animate-pulse rounded-md w-full"></div>
                  <div className="h-8 bg-slate-700/10 animate-pulse rounded-md w-full"></div>
                </div>
              ) : leaderboardError ? (
                <div className="p-6 text-center border border-red-500/20 bg-red-500/5 rounded-xl">
                  <span className="text-xl mb-2 block">⚠️</span>
                  <p className="text-xs text-red-400 mb-4">{leaderboardError}</p>
                  <button
                                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                      darkMode ? "bg-slate-700 text-white hover:bg-slate-600" : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                    }`}
                  >
                    🔄 Retry Connection
                  </button>
                </div>
              ) : leaderboardData.length === 0 ? (
                <div className="p-8 text-center text-slate-500 italic text-sm">
                  No high scores recorded yet on the global leaderboard for {disks} disks. Be the first to secure a place!
                </div>
              ) : (
                <div className="space-y-4">
                  <div className={`overflow-x-auto rounded-xl border ${darkMode ? "border-slate-700/50" : "border-slate-200"}`}>
                    <table className="w-full text-sm text-left">
                      <thead className={`${darkMode ? "bg-slate-900/80 text-slate-300" : "bg-slate-100 text-slate-600"} uppercase text-xs font-bold`}>
                        <tr>
                          <th className="px-6 py-4">Rank</th>
                          <th className="px-6 py-4">Player</th>
                          <th className="px-6 py-4 text-center">Moves</th>
                          <th className="px-6 py-4 text-center">Time</th>
                          <th className="px-6 py-4 text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${darkMode ? "divide-slate-700/20" : "divide-slate-200/60"}`}>
                        {paginatedData.map((row, idx) => {
                          const rank = startIndex + idx + 1;
                          const isCurrentUser = row.username.toLowerCase() === username.toLowerCase();
                          let rankBadge = `${rank}`;
                          if (rank === 1) rankBadge = "🥇 1";
                          else if (rank === 2) rankBadge = "🥈 2";
                          else if (rank === 3) rankBadge = "🥉 3";
 
                          return (
                            <tr
                              key={row.id}
                              className={`transition-colors ${
                                isCurrentUser
                                  ? darkMode
                                    ? "bg-amber-500/10 text-amber-300 font-semibold"
                                    : "bg-amber-50 text-amber-900 font-semibold"
                                  : darkMode
                                  ? "hover:bg-slate-700/40 text-slate-300"
                                  : "hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <td className="px-6 py-4 font-bold">{rankBadge}</td>
                              <td className="px-6 py-4 flex items-center gap-2">
                                <span>{row.username}</span>
                                {isCurrentUser && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold">You</span>}
                              </td>
                              <td className="px-6 py-4 text-center font-mono">{row.moves}</td>
                              <td className="px-6 py-4 text-center font-mono">{formatTime(row.time)}</td>
                              <td className="px-6 py-4 text-right text-xs opacity-75 font-mono">
                                {new Date(row.created_at).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-4 pt-4 border-t border-slate-700/10">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1 ${
                          currentPage === 1
                            ? "opacity-40 cursor-not-allowed text-slate-500 bg-slate-800/10 dark:bg-slate-900/10"
                            : darkMode
                            ? "bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200"
                            : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm"
                        }`}
                      >
                        ◀ Prev
                      </button>

                      {Array.from({ length: totalPages }, (_, idx) => {
                        const pageNum = idx + 1;
                        const isCurrent = pageNum === currentPage;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center justify-center ${
                              isCurrent
                                ? darkMode
                                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                                  : "bg-blue-600 text-white shadow-md shadow-blue-600/10"
                                : darkMode
                                ? "bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700"
                                : "bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm"
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1 ${
                          currentPage === totalPages
                            ? "opacity-40 cursor-not-allowed text-slate-500 bg-slate-800/10 dark:bg-slate-900/10"
                            : darkMode
                            ? "bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200"
                            : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm"
                        }`}
                      >
                        Next ▶
                      </button>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-xs text-slate-500 font-semibold">
                    <span>
                      💡 Showcasing top 100 entries. Caches for 1 hour.
                    </span>
                    <button
                      onClick={() => fetchLeaderboard(true)}
                      className={`px-3 py-1.5 rounded-lg border transition-all active:scale-95 ${
                        darkMode ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300" : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600"
                      }`}
                    >
                      🔄 Force Refresh
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div
          className={`text-center mt-8 text-sm ${
            darkMode ? "text-slate-400" : "text-slate-600"
          }`}
        >
          <p>
            Developed by{" "}
            <a
              href="https://github.com/marcKevzzz"
              target="_blank"
              rel="noopener noreferrer"
              className={`underline transition ${
                darkMode
                  ? "text-blue-400 hover:text-blue-300"
                  : "text-blue-600 hover:text-blue-500"
              }`}
            >
              @marckevzzz
            </a>
          </p>
        </div>
      </div>
      {/* Full-screen Premium Completion Celebration Modal */}
      <AnimatePresence>
        {isComplete && showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 50, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className={`max-w-md w-full rounded-2xl p-8 border shadow-2xl ${
                darkMode
                  ? "bg-slate-900 border-slate-800 text-white"
                  : "bg-white border-slate-200 text-slate-900"
              } text-center relative overflow-hidden`}
            >
              {/* Decorative Glow */}
              <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-blue-500/20 blur-3xl pointer-events-none"></div>
              <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none"></div>

              {/* Celebration Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="w-20 h-20 bg-gradient-to-tr from-yellow-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/20"
              >
                <span className="text-4xl">🏆</span>
              </motion.div>

              <h2 className="text-3xl font-extrabold mb-2 tracking-tight bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
                Victory Achieved!
              </h2>
              <p className={`text-sm mb-6 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                You have successfully completed the {disks}-disk puzzle!
              </p>

              {/* Stats Review */}
              <div className={`grid grid-cols-2 gap-4 p-4 rounded-xl mb-6 ${
                darkMode ? "bg-slate-800/50 border border-slate-700/50" : "bg-slate-50 border border-slate-100"
              }`}>
                <div>
                  <p className={`text-xs uppercase font-semibold tracking-wider mb-1 ${darkMode ? "text-slate-450" : "text-slate-500"}`}>Moves</p>
                  <p className="text-2xl font-black text-blue-500">{moves}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Min Required: {minMoves}</p>
                </div>
                <div>
                  <p className={`text-xs uppercase font-semibold tracking-wider mb-1 ${darkMode ? "text-slate-450" : "text-slate-500"}`}>Time</p>
                  <p className="text-2xl font-black text-emerald-500">{formatTime(time)}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Best: {stats[disks]?.bestTime ? formatTime(stats[disks].bestTime) : "--:--"}
                  </p>
                </div>
              </div>

              {/* Submit to Online Leaderboard */}
              {!hasSubmitted ? (
                <form onSubmit={submitScore} className="space-y-4 mb-6">
                  <div className="text-left">
                    <label htmlFor="username-input" className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5 ml-1">
                      Enter Your Username
                    </label>
                    <input
                      id="username-input"
                      type="text"
                      maxLength={18}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="E.g. GamerPro"
                      required
                      className={`w-full px-4 py-3 rounded-xl border-2 text-sm transition-all outline-none select-text ${
                        darkMode
                          ? "bg-slate-800 border-slate-700 focus:border-blue-500 text-white"
                          : "bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-900"
                      }`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting || !username.trim()}
                    className={`w-full py-3 px-6 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                      isSubmitting || !username.trim()
                        ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/10 active:scale-95"
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      "🚀 Submit to Leaderboards"
                    )}
                  </button>
                </form>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-4 rounded-xl mb-6 flex items-center justify-center gap-2 border text-sm font-semibold ${
                    darkMode ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-emerald-50 border-emerald-100 text-emerald-600"
                  }`}
                >
                  <span>✅ Score Submitted Successfully!</span>
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => resetGame()}
                  className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 ${
                    darkMode ? "bg-slate-800 hover:bg-slate-700 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-850"
                  }`}
                >
                  🎮 Play Again
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3.5 rounded-xl shadow-2xl border bg-slate-900/90 text-white border-red-500/30 backdrop-blur-md"
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-bold">
              ⚠️
            </div>
            <span className="text-sm font-medium text-slate-100">
              {toast.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
