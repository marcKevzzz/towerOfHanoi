import React, { useState, useEffect, useRef } from "react";
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
  const [selectedDisk, setSelectedDisk] = useState(null);
  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem("hanoiStats");
    return saved
      ? JSON.parse(saved)
      : {
          gamesCompleted: 0,
          bestTime: null,
          fewestMoves: null,
          totalTime: 0,
          lastDisks: disks,
        };
  });

  // Minimum moves formula
  useEffect(() => setMinMoves(Math.pow(2, disks) - 1), [disks]);

  // Completion check
  useEffect(() => {
    if (towers[2].length === disks && disks > 0) {
      setIsComplete(true);
      setIsRunning(false);
      clearInterval(timerRef.current);

      setStats((prev) => {
        const newBestTime =
          prev.bestTime === null || time < prev.bestTime ? time : prev.bestTime;
        const newFewestMoves =
          prev.fewestMoves === null || moves < prev.fewestMoves
            ? moves
            : prev.fewestMoves;

        return {
          gamesCompleted: prev.gamesCompleted + 1,
          bestTime: newBestTime,
          fewestMoves: newFewestMoves,
          totalTime: prev.totalTime + time,
          lastDisks: disks,
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
    localStorage.setItem("hanoiStats", JSON.stringify(stats));
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
    setSelectedTower(null);
    setDisks(numDisks);
    setTime(0);
    setIsRunning(false);
  };

  const handleTowerClick = (towerIndex) => {
    if (isComplete) return;
    if (!isRunning && moves === 0) setIsRunning(true);

    if (selectedTower === null) {
      if (towers[towerIndex].length > 0) setSelectedTower(towerIndex);
    } else {
      if (selectedTower === towerIndex) setSelectedTower(null);
      else {
        const fromTower = towers[selectedTower];
        const toTower = towers[towerIndex];
        const disk = fromTower[fromTower.length - 1];
        if (toTower.length === 0 || disk < toTower[toTower.length - 1]) {
          const newTowers = towers.map((t, i) => {
            if (i === selectedTower) return t.slice(0, -1);
            if (i === towerIndex) return [...t, disk];
            return t;
          });
          setTowers(newTowers);
          setMoves((m) => m + 1);
        }
        setSelectedTower(null);
      }
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

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 ${
        darkMode
          ? "bg-gradient-to-br from-slate-900 to-slate-800"
          : "bg-gradient-to-br from-blue-50 to-indigo-100"
      } transition-colors duration-500`}
    >
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
            {isComplete && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-green-400 font-bold text-xl"
              >
                🎉 Completed in {moves} moves!
              </motion.div>
            )}
          </div>
        </div>

        {/* Game Area */}
        <div className="flex justify-around items-end min-h-[300px] sm:h-[420px] mb-8 gap-2 sm:gap-6 px-2">
          {towers.map((tower, i) => {
            const topDisk = tower[tower.length - 1];
            return (
              <div
                key={i}
                onClick={() => handleTowerClick(i)}
                className={`relative flex-1 flex flex-col items-center justify-end cursor-pointer transition-transform duration-200 group`}
              >
                {/* Stick */}
                <div className="relative flex flex-col items-center justify-end h-[200px] sm:h-[300px] w-full">
                  {/* Stick base */}
                  <div
                    className={`absolute bottom-0 w-2 sm:w-3 h-48 sm:h-72 ${
                      darkMode ? "bg-slate-600" : "bg-slate-400"
                    } rounded-t-lg z-10`}
                  ></div>

                  {/* Disks under stick */}
                  <div className="absolute bottom-0 z-10 flex flex-col-reverse items-center justify-start">
                    <AnimatePresence>
                      {tower.map((disk, idx) => {
                        const isTopDisk = disk === topDisk;
                        const isSelected = selectedTower === i && isTopDisk; // selected tower + top disk

                        return (
                          <motion.div
                            key={`${i}-${disk}`}
                            layout
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{
                              type: "spring",
                              stiffness: 120,
                              damping: 10,
                            }}
                            onClick={(e) => {
                              e.stopPropagation(); // prevent tower click firing
                              // Always select the tower when any disk is clicked
                              setSelectedTower((prev) =>
                                prev === i ? null : i
                              );
                            }}
                            className={`h-8 sm:h-10 ${getDiskColor(
                              disk
                            )} rounded-lg shadow-lg mb-1 relative z-0 transition duration-300 cursor-pointer
                            ${
                              isTopDisk
                                ? "hover:brightness-110 hover:-translate-y-1 sm:hover:-translate-y-2 hover:scale-105 sm:hover:scale-110"
                                : ""
                            }
                            ${
                              isSelected
                                ? "brightness-110 -translate-y-1 sm:-translate-y-2 scale-105 sm:scale-110 ring-2 ring-yellow-400"
                                : ""
                            }
                            `}
                            style={{
                              width: `clamp(30px, calc(${
                                getDiskWidth(disk) * 0.075
                              }vw + 40px), 800px)`,
                            }}
                          />
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* Tower label and base */}
                  <div
                    className={`absolute bottom-[-20px] sm:bottom-[-30px] w-20 md:w-56 h-4 sm:h-5 sm:w-30 ${
                      darkMode ? "bg-slate-700" : "bg-slate-500"
                    } rounded-lg shadow-md`}
                  ></div>
                </div>
                <div
                  className={`${
                    darkMode ? "text-slate-400" : "text-slate-600"
                  } mt-10 sm:mt-16 text-xs sm:text-sm font-medium`}
                >
                  Tower {i + 1}
                </div>
              </div>
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

        {/* Persistent Stats */}
        <div
          className={`${
            darkMode ? "bg-slate-800" : "bg-white shadow-lg"
          } rounded-xl p-6 mb-6 transition-all duration-500`}
        >
          <h2
            className={`text-2xl font-semibold mb-4 ${
              darkMode ? "text-white" : "text-slate-900"
            }`}
          >
            📊 Player Statistics
          </h2>
          <div
            className={`grid grid-cols-2 md:grid-cols-3 gap-4 text-center ${
              darkMode ? "text-slate-200" : "text-slate-700"
            }`}
          >
            <div>
              <p className="text-lg font-medium">🏆 Games Completed</p>
              <p className="text-2xl font-bold text-blue-400">
                {stats.gamesCompleted}
              </p>
            </div>
            <div>
              <p className="text-lg font-medium">⏱ Best Time</p>
              <p className="text-2xl font-bold text-green-400">
                {stats.bestTime ? formatTime(stats.bestTime) : "--:--"}
              </p>
            </div>
            <div>
              <p className="text-lg font-medium">🧮 Fewest Moves</p>
              <p className="text-2xl font-bold text-yellow-400">
                {stats.fewestMoves ?? "--"}
              </p>
            </div>
            <div>
              <p className="text-lg font-medium">🕒 Total Time Played</p>
              <p className="text-2xl font-bold text-purple-400">
                {formatTime(stats.totalTime)}
              </p>
            </div>
            <div>
              <p className="text-lg font-medium">🎮 Last Disk Count</p>
              <p className="text-2xl font-bold text-pink-400">
                {stats.lastDisks}
              </p>
            </div>
          </div>
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
    </div>
  );
}
