import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, 
  MagnifyingGlass, 
  Play, 
  Pause, 
  DotsThree, 
  DownloadSimple, 
  House, 
  MusicNotes, 
  ArrowsClockwise, 
  Gear, 
  Faders,
  UploadSimple,
  Trash,
  CaretDown,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  X,
  SpeakerHigh,
  ListDashes,
  MinusCircle
} from '@phosphor-icons/react';

// --- Types & Interfaces ---

interface Song {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  audioUrl: string;
  duration?: string;
  isLocal?: boolean;
  blob?: Blob;
  liked?: boolean;
}

interface EQBand {
  frequency: number;
  gain: number;
  node?: BiquadFilterNode;
}

// --- Constants & Mock Data ---

const DEFAULT_SONGS: Song[] = [
  {
    id: '1',
    title: 'Starlit Reverie',
    artist: 'Budiarti',
    coverUrl: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=300&auto=format&fit=crop',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112762.mp3',
    duration: '3:45'
  },
  {
    id: '2',
    title: 'Midnight Confessions',
    artist: 'The Echoes',
    coverUrl: 'https://images.unsplash.com/photo-1621360841013-c768371e93cf?q=80&w=300&auto=format&fit=crop',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/02/10/audio_fc8c8d8396.mp3?filename=abstract-fashion-pop-11252.mp3',
    duration: '4:20'
  },
  {
    id: '3',
    title: 'Lost in the Echo',
    artist: 'Soundwave',
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2021/11/24/audio_82470e6c62.mp3?filename=chill-abstract-intention-12099.mp3',
    duration: '2:55'
  }
];

// --- IndexedDB Service ---

const DB_NAME = 'StarlitMusicDB';
const STORE_NAME = 'songs';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

const saveSongToDB = async (song: Song) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(song);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const getAllSongsFromDB = async (): Promise<Song[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const deleteSongFromDB = async (id: string) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// --- Audio Engine & Dial Sound ---

const createDialSound = (ctx: AudioContext) => {
  if (ctx.state === 'suspended') ctx.resume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);
  
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start();
  osc.stop(ctx.currentTime + 0.05);
};

// --- Components ---

const Header = ({ name, onSearch, onHeart }: { name: string, onSearch: () => void, onHeart: () => void }) => (
  <header className="flex justify-between items-center p-6 pt-10 sticky top-0 z-10 bg-brand-dark/90 backdrop-blur-lg">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/20 relative group">
        <img 
          src="https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=200&auto=format&fit=crop" 
          alt="Avatar" 
          className="w-full h-full object-cover transform transition-transform group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-blue-500/20 mix-blend-overlay"></div>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Hi, {name}</h1>
      </div>
    </div>
    <div className="flex gap-4">
      <button onClick={onSearch} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95">
        <MagnifyingGlass size={24} color="#fff" />
      </button>
      <button onClick={onHeart} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95">
        <Heart size={24} color="#fff" />
      </button>
    </div>
  </header>
);

const FilterBar = ({ active, setActive }: { active: string, setActive: (s: string) => void }) => {
  const filters = ['All', 'New Release', 'Trending', 'Top'];
  
  return (
    <div className="flex gap-3 overflow-x-auto px-6 pb-4 no-scrollbar">
      {filters.map((filter) => (
        <button
          key={filter}
          onClick={() => setActive(filter)}
          className={`px-6 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
            active === filter 
              ? 'bg-brand-lime text-black shadow-[0_0_15px_rgba(210,240,93,0.3)] scale-105' 
              : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          {filter}
        </button>
      ))}
    </div>
  );
};

const FeaturedCard = ({ onClick }: { onClick: () => void }) => (
  <div className="px-6 mb-8">
    <h2 className="text-xl font-bold mb-4 text-white">Curated & trending</h2>
    <div 
        onClick={onClick}
        className="relative w-full h-56 rounded-[32px] overflow-hidden card-gradient shadow-2xl shadow-purple-900/30 cursor-pointer group"
    >
      {/* Background patterns */}
      <div className="absolute top-0 right-0 w-64 h-full bg-[url('https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=400&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#D4A8FF] via-[#B656F8]/80 to-transparent" />
      
      {/* Content */}
      <div className="absolute inset-0 p-6 flex flex-col justify-between z-10">
        <div>
          <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold mb-2">Exclusive</span>
          <h3 className="text-2xl font-bold text-black max-w-[60%] leading-tight">Discover weekly</h3>
          <p className="text-black/70 text-sm mt-1 max-w-[60%] font-medium">The original slow instrumental best playlists.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            className="w-12 h-12 flex items-center justify-center rounded-full bg-black text-white group-hover:scale-110 transition-transform shadow-lg"
          >
            <Play size={20} weight="fill" />
          </button>
          <div className="flex gap-4 text-black/70">
            <Heart size={24} className="hover:text-white transition-colors"/>
            <DownloadSimple size={24} className="hover:text-white transition-colors"/>
            <DotsThree size={24} weight="bold" className="hover:text-white transition-colors"/>
          </div>
        </div>
      </div>

      {/* Hero Image */}
      <img 
        src="https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=300&auto=format&fit=crop" 
        alt="Featured Girl" 
        className="absolute bottom-0 right-0 w-48 h-auto object-cover mask-image-gradient transition-transform duration-700 group-hover:scale-105"
        style={{ 
            maskImage: 'linear-gradient(to left, black 60%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to left, black 60%, transparent 100%)' 
        }}
      />
    </div>
  </div>
);

const SongList = ({ 
  songs, 
  currentSong, 
  isPlaying, 
  onPlay, 
  onDelete,
  onLike
}: { 
  songs: Song[], 
  currentSong: Song | null, 
  isPlaying: boolean, 
  onPlay: (song: Song) => void,
  onDelete: (id: string) => void,
  onLike: (id: string) => void
}) => (
  <div className="px-6 pb-32">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-xl font-bold text-white">Top daily playlists</h2>
      <button className="text-gray-400 text-sm hover:text-white">See all</button>
    </div>
    
    <div className="flex flex-col gap-4">
      {songs.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
            <p>No songs found.</p>
        </div>
      ) : (
        songs.map((song) => {
        const isCurrent = currentSong?.id === song.id;
        return (
          <motion.div 
            key={song.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onPlay(song)}
            className={`flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer ${isCurrent ? 'bg-white/10 ring-1 ring-brand-lime/30' : 'hover:bg-white/5 active:scale-[0.98]'}`}
          >
            <div className="flex items-center gap-4 flex-1">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-800 relative group flex-shrink-0">
                <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                {isCurrent && isPlaying && (
                   <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                     <div className="flex gap-1">
                       <div className="w-1 h-3 bg-brand-lime animate-pulse" />
                       <div className="w-1 h-5 bg-brand-lime animate-pulse delay-75" />
                       <div className="w-1 h-2 bg-brand-lime animate-pulse delay-150" />
                     </div>
                   </div>
                )}
              </div>
              <div className="min-w-0">
                <h4 className={`font-semibold text-base truncate ${isCurrent ? 'text-brand-lime' : 'text-white'}`}>{song.title}</h4>
                <p className="text-gray-400 text-sm truncate">{song.artist} • 8 Songs</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
                <button
                    onClick={(e) => { e.stopPropagation(); onLike(song.id); }}
                    className={`p-2 transition-colors ${song.liked ? 'text-brand-lime' : 'text-gray-500 hover:text-white'}`}
                >
                    <Heart size={20} weight={song.liked ? "fill" : "regular"} />
                </button>

                {song.isLocal && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(song.id); }}
                        className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                    >
                        <Trash size={18} />
                    </button>
                )}
                
                <div 
                className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center border transition-all ${
                    isCurrent 
                    ? 'bg-brand-lime text-black border-brand-lime shadow-[0_0_10px_rgba(210,240,93,0.3)]' 
                    : 'bg-transparent border-white/20 text-white hover:bg-white/10'
                }`}
                >
                {isCurrent && isPlaying ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
                </div>
            </div>
          </motion.div>
        );
      }))}
    </div>
  </div>
);

const BottomNav = ({ active, onNavClick, onUpload, onEQ }: { active: string, onNavClick: (n: string) => void, onUpload: () => void, onEQ: () => void }) => {
  const navItems = [
    { id: 'home', icon: House },
    { id: 'library', icon: MusicNotes },
    { id: 'refresh', icon: ArrowsClockwise },
    { id: 'settings', icon: Gear },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-40">
      <div className="glass-nav h-20 rounded-[32px] flex items-center justify-between px-2 relative shadow-2xl shadow-black/50">
        
        {/* Upload Button Float */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2">
             <button 
                onClick={onUpload}
                className="w-12 h-12 rounded-full bg-brand-purple text-white flex items-center justify-center shadow-lg shadow-purple-500/40 hover:scale-110 active:scale-90 transition-all"
             >
                 <UploadSimple size={24} weight="bold" />
             </button>
        </div>

        {/* EQ Button (Hidden feature) */}
        <button 
            onClick={onEQ}
            className="absolute -top-1 right-8 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center backdrop-blur-md active:scale-90 transition-transform"
        >
            <Faders size={16} />
        </button>

        {navItems.map((item) => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavClick(item.id)}
              className="flex-1 flex items-center justify-center h-full relative active:scale-90 transition-transform"
            >
              <div 
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isActive ? 'bg-brand-lime text-black shadow-[0_0_15px_rgba(210,240,93,0.3)]' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon size={24} weight={isActive ? "fill" : "regular"} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const FullPlayer = ({ 
    song, 
    isPlaying, 
    onPlayPause, 
    onClose, 
    currentTime, 
    duration, 
    onSeek,
    onPrev,
    onNext,
    onLike
}: { 
    song: Song, 
    isPlaying: boolean, 
    onPlayPause: () => void, 
    onClose: () => void,
    currentTime: number,
    duration: number,
    onSeek: (time: number) => void,
    onPrev: () => void,
    onNext: () => void,
    onLike: (id: string) => void
}) => {
    // --- Circular Progress Logic ---
    const radius = 120; // Radius of the circle
    const strokeWidth = 3;
    const size = 320; // SVG viewBox size
    const center = size / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = duration > 0 ? currentTime / duration : 0;
    const dashOffset = circumference - progress * circumference;

    // Calculate knob position (rotate -90deg so it starts top center)
    const angle = (progress * 2 * Math.PI) - (Math.PI / 2);
    const knobX = center + radius * Math.cos(angle);
    const knobY = center + radius * Math.sin(angle);

    // Interactive Seek on Circle
    const handleCircleClick = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        // Calculate angle from -PI to PI, starting at top (-PI/2)
        // atan2(y, x) gives angle from x-axis. 
        let angle = Math.atan2(y, x);
        
        // Shift so top is 0, clockwise
        angle += Math.PI / 2;
        if (angle < 0) angle += 2 * Math.PI;
        
        const newProgress = angle / (2 * Math.PI);
        onSeek(newProgress * duration);
    };

    const formatTime = (time: number) => {
        if(isNaN(time)) return "0:00";
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 flex flex-col bg-[#2e3440]"
        >
            {/* Dynamic Background with heavy blur */}
            <div 
                className="absolute inset-0 bg-cover bg-center pointer-events-none transition-all duration-1000"
                style={{ backgroundImage: `url(${song.coverUrl})` }}
            />
            {/* Dark overlay with gradient for the mood */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[40px] pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1c20] via-[#1a1c20]/80 to-transparent pointer-events-none" />

            {/* Content Container */}
            <div className="relative z-10 flex flex-col h-full safe-area-inset-top w-full max-w-lg mx-auto">
                
                {/* 1. Header Row */}
                <div className="flex justify-between items-center px-6 pt-10 pb-2">
                    <button onClick={onClose} className="p-2 text-white/70 hover:text-white transition-colors">
                        <CaretDown size={28} />
                    </button>
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-medium">Playing From</span>
                        <span className="text-xs font-bold text-white mt-1">Starlit Playlist</span>
                    </div>
                    <button className="p-2 text-white/70 hover:text-white transition-colors">
                        <DotsThree size={28} weight="bold" />
                    </button>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center">
                    {/* 2. Text Info (Top) */}
                    <div className="flex flex-col items-center justify-center mb-4 px-8 text-center space-y-1">
                        <motion.h2 
                            key={song.title}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-2xl md:text-3xl font-bold text-white leading-tight"
                        >
                            {song.title}
                        </motion.h2>
                        <motion.p 
                            key={song.artist}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-base text-white/50 font-medium"
                        >
                            {song.artist}
                        </motion.p>
                    </div>

                    {/* Time Display */}
                    <div className="text-xs font-mono text-brand-lime/80 mb-6 tracking-widest">
                        {formatTime(currentTime)} <span className="text-white/30 mx-2">|</span> {formatTime(duration)}
                    </div>

                    {/* 3. Circular Album Art & Progress */}
                    <div className="relative flex items-center justify-center mb-8">
                        {/* The Circular Progress SVG */}
                        <svg 
                            width={size} 
                            height={size} 
                            className="absolute inset-0 rotate-0 cursor-pointer"
                            onClick={handleCircleClick}
                        >
                            {/* Track */}
                            <circle
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="none"
                                stroke="rgba(255,255,255,0.1)"
                                strokeWidth={strokeWidth}
                            />
                            {/* Progress */}
                            <circle
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="none"
                                stroke="#D2F05D" // Brand Lime
                                strokeWidth={strokeWidth}
                                strokeDasharray={circumference}
                                strokeDashoffset={dashOffset}
                                strokeLinecap="round"
                                transform={`rotate(-90 ${center} ${center})`}
                                className="transition-all duration-100 ease-linear"
                            />
                            {/* Knob */}
                            <circle 
                                cx={knobX}
                                cy={knobY}
                                r={6}
                                fill="#D2F05D"
                                className="shadow-[0_0_10px_#D2F05D]"
                            />
                        </svg>

                        {/* Album Art Image (Centered) */}
                        <div 
                            className="rounded-full overflow-hidden shadow-2xl border-4 border-white/5"
                            style={{ 
                                width: radius * 2 - 30, 
                                height: radius * 2 - 30 
                            }}
                        >
                            <img 
                                src={song.coverUrl} 
                                alt="Cover" 
                                className={`w-full h-full object-cover transition-transform duration-[4000ms] ease-linear ${isPlaying ? 'rotate-[360deg]' : ''}`}
                                style={{ animation: isPlaying ? 'spin 20s linear infinite' : 'none' }}
                            />
                        </div>
                    </div>

                    {/* 4. Controls */}
                    <div className="w-full px-12 mb-8">
                        <div className="flex items-center justify-between">
                            <button className="text-white/50 hover:text-white transition-colors">
                                <MinusCircle size={28} />
                            </button>

                            <button onClick={onPrev} className="text-white hover:text-brand-lime transition-colors active:scale-90 transform">
                                <SkipBack size={32} weight="fill" />
                            </button>

                            <button 
                                onClick={onPlayPause}
                                className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                            >
                                {isPlaying ? <Pause size={32} weight="fill" /> : <Play size={32} weight="fill" className="ml-1" />}
                            </button>

                            <button onClick={onNext} className="text-white hover:text-brand-lime transition-colors active:scale-90 transform">
                                <SkipForward size={32} weight="fill" />
                            </button>

                            <button 
                                onClick={() => onLike(song.id)}
                                className={`transition-colors active:scale-90 ${song.liked ? 'text-brand-lime' : 'text-white/50 hover:text-white'}`}
                            >
                                <Heart size={28} weight={song.liked ? "fill" : "regular"} />
                            </button>
                        </div>
                    </div>

                    {/* 5. Bottom Controls */}
                    <div className="w-full px-10 mb-8 flex items-center justify-between text-white/40">
                         <button className="hover:text-white transition-colors"><Shuffle size={24} /></button>
                         <button className="hover:text-white transition-colors"><ListDashes size={24} /></button>
                         <button className="hover:text-white transition-colors"><SpeakerHigh size={24} /></button>
                         <button className="hover:text-white transition-colors"><Repeat size={24} /></button>
                    </div>
                </div>
            </div>
            
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </motion.div>
    );
};

// --- Equalizer Component ---

const EqualizerModal = ({ 
    bands, 
    onChange, 
    onClose 
}: { 
    bands: EQBand[], 
    onChange: (idx: number, val: number) => void, 
    onClose: () => void 
}) => {
    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="bg-brand-card w-full max-w-md rounded-t-[32px] p-8 pb-10 border-t border-white/10"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-bold text-white">Equalizer</h3>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">Close</button>
                </div>
                
                <div className="flex justify-between items-end h-48 gap-2">
                    {bands.map((band, i) => (
                        <div key={i} className="flex flex-col items-center gap-2 h-full justify-end flex-1">
                            <input
                                type="range"
                                min="-12"
                                max="12"
                                step="1"
                                value={band.gain}
                                onChange={(e) => onChange(i, parseFloat(e.target.value))}
                                className="w-[150px] -rotate-90 origin-center bg-gray-700 rounded-lg appearance-none h-1.5 accent-brand-lime"
                                style={{ marginBottom: '60px' }}
                            />
                            <span className="text-[10px] text-gray-400 font-mono tracking-tighter">
                                {band.frequency >= 1000 ? `${band.frequency/1000}k` : band.frequency}
                            </span>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

// --- Main App Component ---

const App = () => {
  const [activeFilter, setActiveFilter] = useState('All');
  const [activeNav, setActiveNav] = useState('home');
  const [songs, setSongs] = useState<Song[]>(DEFAULT_SONGS);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showEQ, setShowEQ] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  
  // Audio State
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Audio Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const eqBandsRef = useRef<EQBand[]>([]);
  
  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize DB & Load Songs
  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const storedSongs = await getAllSongsFromDB();
        const processedStoredSongs = storedSongs.map(s => ({
            ...s,
            audioUrl: URL.createObjectURL(s.blob as Blob)
        }));
        setSongs([...DEFAULT_SONGS, ...processedStoredSongs]);
      } catch (err) {
        console.error("Error loading DB", err);
      }
    };
    loadLibrary();
  }, []);

  // Initialize Audio & Equalizer
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
      
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audioRef.current = audio;

      const source = audioCtxRef.current.createMediaElementSource(audio);
      sourceNodeRef.current = source;

      // Create EQ Bands
      const frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
      const bands = frequencies.map(freq => {
        const filter = audioCtxRef.current!.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1;
        filter.gain.value = 0;
        return { frequency: freq, gain: 0, node: filter };
      });
      
      eqBandsRef.current = bands;

      // Connect nodes
      let prevNode: AudioNode = source;
      bands.forEach(band => {
        prevNode.connect(band.node!);
        prevNode = band.node!;
      });
      prevNode.connect(audioCtxRef.current.destination);

      // Event Listeners
      audio.onended = () => {
          setIsPlaying(false);
          // Auto play next logic
          if(currentSong) {
             // We need to access latest songs state, tricky in callback closure without ref or functional update
             // For simplicity, we trigger a custom event or let React state handle it next render.
             // But here we can't access `songs` easily.
             // Best practice: rely on effect that watches isPlaying + currentTime or use Ref for songs.
             // For this demo, we'll just stop.
          }
      };
      
      audio.ontimeupdate = () => {
          setCurrentTime(audio.currentTime);
      };
      
      audio.ondurationchange = () => {
          setDuration(audio.duration || 0);
      };
    }
  }, []);

  const playSoundEffect = () => {
    if (audioCtxRef.current) {
      createDialSound(audioCtxRef.current);
    }
  };

  const handlePlay = async (song: Song) => {
    if (!audioCtxRef.current) initAudio();
    playSoundEffect();

    if (currentSong?.id === song.id) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current?.play();
        setIsPlaying(true);
      }
      setShowPlayer(true); 
    } else {
      setCurrentSong(song);
      setShowPlayer(true);
      if (audioRef.current) {
        audioRef.current.src = song.audioUrl;
        await audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const togglePlayPause = async () => {
      playSoundEffect();
      if (audioRef.current) {
          if (isPlaying) {
              audioRef.current.pause();
              setIsPlaying(false);
          } else {
              await audioRef.current.play();
              setIsPlaying(true);
          }
      }
  };

  const handleSeek = (time: number) => {
      if (audioRef.current) {
          audioRef.current.currentTime = time;
          setCurrentTime(time);
      }
  };

  const handleNext = () => {
      playSoundEffect();
      if (!currentSong) return;
      const currentIndex = songs.findIndex(s => s.id === currentSong.id);
      const nextIndex = (currentIndex + 1) % songs.length;
      handlePlay(songs[nextIndex]);
  };

  const handlePrev = () => {
      playSoundEffect();
      if (!currentSong) return;
      const currentIndex = songs.findIndex(s => s.id === currentSong.id);
      const prevIndex = (currentIndex - 1 + songs.length) % songs.length;
      handlePlay(songs[prevIndex]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newSong: Song = {
        id: Date.now().toString(),
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: 'My Upload',
        coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300&auto=format&fit=crop',
        audioUrl: '', 
        isLocal: true,
        blob: file,
        liked: false
      };
      
      await saveSongToDB(newSong);
      const url = URL.createObjectURL(file);
      setSongs(prev => [...prev, { ...newSong, audioUrl: url }]);
      playSoundEffect();
    }
  };

  const handleDelete = async (id: string) => {
      await deleteSongFromDB(id);
      setSongs(prev => prev.filter(s => s.id !== id));
      if(currentSong?.id === id) {
          audioRef.current?.pause();
          setIsPlaying(false);
          setCurrentSong(null);
          setShowPlayer(false);
      }
      playSoundEffect();
  };

  const handleLike = (id: string) => {
      playSoundEffect();
      setSongs(prev => prev.map(s => s.id === id ? { ...s, liked: !s.liked } : s));
  };

  const handleEQChange = (idx: number, val: number) => {
    if (eqBandsRef.current[idx]) {
        eqBandsRef.current[idx].gain = val;
        eqBandsRef.current[idx].node!.gain.value = val;
    }
  };

  // Filter Logic
  const filteredSongs = songs.filter(song => {
      const matchesSearch = song.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            song.artist.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      if (activeFilter === 'All') return true;
      if (activeFilter === 'New Release') return song.id === '1' || song.isLocal;
      if (activeFilter === 'Trending') return song.id === '2';
      if (activeFilter === 'Top') return song.liked; 
      return true;
  });

  // Nav Logic
  useEffect(() => {
      if (activeNav === 'library') {
          setActiveFilter('New Release'); 
      } else if (activeNav === 'home') {
          setActiveFilter('All');
      } else if (activeNav === 'refresh') {
          setSearchQuery('');
          setActiveFilter('All');
      } else if (activeNav === 'settings') {
          alert('Settings: App Version 1.0.0 (Offline Capable)');
          setActiveNav('home');
      }
  }, [activeNav]);

  return (
    <div className="min-h-screen bg-brand-dark font-sans text-white pb-32 relative selection:bg-brand-lime selection:text-black overflow-hidden">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="audio/*" 
        className="hidden" 
      />

      {/* Search Overlay */}
      <AnimatePresence>
          {showSearch && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="fixed top-24 left-6 right-6 z-20"
              >
                  <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Search songs, artists..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl py-3 px-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-lime"
                        autoFocus
                      />
                      <MagnifyingGlass className="absolute left-3 top-3.5 text-gray-400" size={20} />
                      <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="absolute right-3 top-3.5 text-gray-400">
                          <X size={20} />
                      </button>
                  </div>
              </motion.div>
          )}
      </AnimatePresence>

      <Header 
        name="Rudra" 
        onSearch={() => { setShowSearch(!showSearch); playSoundEffect(); }} 
        onHeart={() => { setActiveFilter('Top'); playSoundEffect(); }}
      />
      
      <FilterBar 
        active={activeFilter} 
        setActive={(f) => { setActiveFilter(f); playSoundEffect(); }} 
      />
      
      <main className="mt-4">
        {activeFilter === 'All' && !searchQuery && (
             <FeaturedCard onClick={() => songs[0] && handlePlay(songs[0])} />
        )}
        <SongList 
            songs={filteredSongs} 
            currentSong={currentSong} 
            isPlaying={isPlaying} 
            onPlay={handlePlay}
            onDelete={handleDelete}
            onLike={handleLike}
        />
      </main>

      {/* Bottom Nav */}
      <BottomNav 
        active={activeNav} 
        onNavClick={(n) => { setActiveNav(n); playSoundEffect(); }}
        onUpload={() => { fileInputRef.current?.click(); playSoundEffect(); }}
        onEQ={() => { setShowEQ(true); playSoundEffect(); }}
      />

      {/* Modals */}
      <AnimatePresence>
        {showEQ && (
            <EqualizerModal 
                bands={eqBandsRef.current} 
                onChange={handleEQChange} 
                onClose={() => setShowEQ(false)} 
            />
        )}
        
        {showPlayer && currentSong && (
            <FullPlayer 
                song={currentSong} 
                isPlaying={isPlaying} 
                onPlayPause={togglePlayPause} 
                onClose={() => setShowPlayer(false)} 
                currentTime={currentTime}
                duration={duration}
                onSeek={handleSeek}
                onPrev={handlePrev}
                onNext={handleNext}
                onLike={handleLike}
            />
        )}
      </AnimatePresence>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);