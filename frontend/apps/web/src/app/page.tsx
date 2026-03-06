"use client";

import React from "react";
import Link from "next/link";
import { motion, Variants } from "framer-motion";
import { Button, Card, CardContent } from "@ssot/ui";

// Framer Motion Animation Variants
const containerVariants: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

export default function HomePage() {
  return (
    <div className="w-full text-slate-200">
      {/* 🚀 HERO SECTION */}
      <section className="relative min-h-[85vh] flex flex-col items-center justify-center text-center px-4">
        {/* Background Grids for Hero */}
        <div className="absolute inset-0 pointer-events-none bg-[url('/grid.svg')] bg-center opacity-10 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent)]" aria-hidden="true" />

        <motion.div
          className="relative z-10 max-w-5xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium tracking-wide">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Fully On-Chain Casino
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-5xl md:text-7xl font-black tracking-tight mb-6 text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500"
          >
            VERIFIABLY FAIR <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">ON-CHAIN GAMING</span>
          </motion.h1>

          <motion.p variants={itemVariants} className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Experience the next generation of decentralized betting. No deposits, non-custodial execution, and 100% transparent verifiable randomness powered by Chainlink VRF.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/games">
              <Button size="lg" className="w-full sm:w-auto px-8 py-6 text-lg font-bold bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 shadow-xl shadow-emerald-900/40 rounded-xl transition-all hover:scale-105 active:scale-95">
                Start Playing
              </Button>
            </Link>
            <Link href="/liquidity">
              <Button size="lg" variant="outline" className="w-full sm:w-auto px-8 py-6 text-lg font-bold border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-white shadow-xl rounded-xl transition-all hover:scale-105 active:scale-95 backdrop-blur-md">
                Earn as House (Provide LP)
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* 📊 KPI RIBBON SECTION */}
      <section className="relative z-20 max-w-6xl mx-auto px-4 -mt-16 sm:-mt-24 mb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {/* KPI Cards using dark glassmorphism */}
          {[
            { label: "Total Wagered", value: "$4.2M+", icon: "💰" },
            { label: "Total Bets", value: "1.8M+", icon: "🎯" },
            { label: "House Edge", value: "1.00%", icon: "🏦" },
            { label: "Provably Fair", value: "Yes", icon: "🔗" }
          ].map((stat, idx) => (
            <Card key={idx} className="bg-slate-900/80 border-slate-800 backdrop-blur-xl shadow-2xl">
              <CardContent className="p-6">
                <div className="text-3xl mb-2 opacity-80">{stat.icon}</div>
                <div className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">{stat.label}</div>
                <div className="text-2xl md:text-3xl font-bold text-white tabular-nums tracking-tight">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      </section>

      {/* 🎲 FEATURED GAMES SECTION */}
      <section className="py-20 border-t border-slate-800/50 relative">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">Featured <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Games</span></h2>
            <p className="text-slate-400 text-lg">Instant payouts. Direct from your wallet.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Game Cards */}
            {[
              { id: 'dice', name: 'Dice', desc: 'Classic over/under with 99% RTP', color: 'from-blue-500/20 to-blue-900/20', icon: '🎲' },
              { id: 'cointoss', name: 'Coin Toss', desc: 'Heads or tails? Double or nothing.', color: 'from-amber-500/20 to-amber-900/20', icon: '🪙' },
              { id: 'roulette', name: 'Roulette', desc: 'European roulette on-chain', color: 'from-rose-500/20 to-rose-900/20', icon: '🎯' },
              { id: 'keno', name: 'Keno', desc: 'Pick your lucky numbers', color: 'from-purple-500/20 to-purple-900/20', icon: '🔢' }
            ].map((game) => (
              <Link key={game.id} href={`/games/${game.id}`}>
                <Card className={`group cursor-pointer relative overflow-hidden bg-slate-900/40 border-slate-800 hover:border-slate-600 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-cyan-900/20 h-full`}>
                  <div className={`absolute inset-0 bg-gradient-to-b ${game.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  <CardContent className="p-8 relative z-10 flex flex-col items-center text-center">
                    <div className="text-6xl mb-6 transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300 drop-shadow-2xl">
                      {game.icon}
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">{game.name}</h3>
                    <p className="text-slate-400 leading-relaxed text-sm">{game.desc}</p>
                    <div className="mt-8 flex items-center text-emerald-400 font-semibold opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                      Play Now
                      <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 🔴 LIVE BETS LEADERBOARD (MOCK) */}
      <section className="py-20 mb-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              Live Bets
            </h2>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800/50 text-slate-400 text-sm">
                    <th className="p-4 font-medium uppercase tracking-wider">Game</th>
                    <th className="p-4 font-medium uppercase tracking-wider">Player</th>
                    <th className="p-4 font-medium uppercase tracking-wider">Time</th>
                    <th className="p-4 font-medium uppercase tracking-widertext-right">Wager</th>
                    <th className="p-4 font-medium uppercase tracking-wider text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {[
                    { game: "Dice", user: "0x12...4f9A", time: "1 min ago", wager: "50 USDC", result: "+100 USDC", win: true },
                    { game: "Roulette", user: "0x89...2B11", time: "3 mins ago", wager: "10 USDC", result: "-10 USDC", win: false },
                    { game: "Coin Toss", user: "0x33...Cc90", time: "5 mins ago", wager: "25 USDC", result: "+50 USDC", win: true },
                    { game: "Dice", user: "0x4A...7d2f", time: "7 mins ago", wager: "100 USDC", result: "-100 USDC", win: false },
                    { game: "Keno", user: "0x91...Ef00", time: "12 mins ago", wager: "5 USDC", result: "+125 USDC", win: true },
                  ].map((log, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 font-medium text-white">{log.game}</td>
                      <td className="p-4 text-slate-400 text-sm font-mono">{log.user}</td>
                      <td className="p-4 text-slate-500 text-sm">{log.time}</td>
                      <td className="p-4 text-white font-medium text-right">{log.wager}</td>
                      <td className={`p-4 font-bold text-right ${log.win ? "text-emerald-400" : "text-slate-500"}`}>
                        {log.result}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

