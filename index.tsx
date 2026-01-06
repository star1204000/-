import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Dumbbell, 
  MessageSquare, 
  Send, 
  RotateCcw, 
  Trophy, 
  Flame, 
  User, 
  CheckCircle2, 
  Circle,
  Sparkles,
  Zap,
  Music,
  Play,
  Pause,
  ArrowRight,
  Quote
} from "lucide-react";
import ReactMarkdown from 'react-markdown';

// --- Configuration ---
const MODEL_NAME = "gemini-3-flash-preview";

// Music Playlist (Stable Demo URLs)
const PLAYLIST = [
  { title: "Cyber Gym", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { title: "Power Lift", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" },
  { title: "Cardio Flow", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" }
];

// Types
interface UserProfile {
  name: string;
  height: string; // cm
  weight: string; // kg
  level: "初学者" | "中级" | "大神";
}

interface Message {
  role: "user" | "model";
  text: string;
}

interface Exercise {
  name: string;
  reps: string;
  notes: string;
}

interface WorkoutPlan {
  title: string;
  difficulty: string;
  focus: string; // e.g., "减脂塑形" or "核心增肌"
  exercises: Exercise[];
}

// --- App Component ---
const App = () => {
  // --- State ---
  // Onboarding & Profile
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tempProfile, setTempProfile] = useState<UserProfile>({
    name: "刘杰",
    height: "",
    weight: "",
    level: "初学者"
  });

  // Main App State
  const [activeTab, setActiveTab] = useState<"plan" | "chat">("plan");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [dailyQuote, setDailyQuote] = useState<string>("正在加载今日精神氮泵...");
  
  // Plan State
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [completedExercises, setCompletedExercises] = useState<Set<number>>(new Set());

  // Music State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize GenAI
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // --- Effects ---

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Audio Player Initialization
  useEffect(() => {
    if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.loop = true;
        // Pre-load first track
        audioRef.current.src = PLAYLIST[0].url;
    }
  }, []);

  // Handle Track Change
  useEffect(() => {
      if (audioRef.current) {
          // Only change src if it's different (avoids reload on initial render if already set)
          if (audioRef.current.src !== PLAYLIST[currentTrackIndex].url) {
              audioRef.current.src = PLAYLIST[currentTrackIndex].url;
              if (isPlaying) {
                  audioRef.current.play().catch(e => {
                      console.error("Audio play failed on track change", e);
                      setIsPlaying(false);
                  });
              }
          }
      }
  }, [currentTrackIndex]);

  // Handle Play/Pause
  useEffect(() => {
      if (audioRef.current) {
          if (isPlaying) {
              audioRef.current.play().catch(e => {
                  console.error("Audio play failed", e);
                  setIsPlaying(false);
                  alert("无法播放音频，请检查网络连接。");
              });
          } else {
              audioRef.current.pause();
          }
      }
  }, [isPlaying]);

  // Generate Daily Quote on Profile Load
  useEffect(() => {
    if (profile) {
        generateDailyQuote();
    }
  }, [profile]);

  // --- Logic ---

  const getSystemInstruction = () => {
    const stats = profile ? `学员数据：身高${profile.height}cm，体重${profile.weight}kg，水平：${profile.level}。` : "";
    return `
    你是一位世界级的健身教练“核心风暴”，专门负责学员“${profile?.name || '刘杰'}”的腹肌训练。
    ${stats}
    你的性格：硬核、毒舌但充满关怀、极度热血。
    你的任务：
    1. 根据学员的身体数据（BMI）提供专业的训练建议。
    2. 在聊天中时刻激励他。
    注意：使用简体中文。如果用户BMI过高，强调减脂；如果过低，强调增肌。
    `;
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempProfile.height || !tempProfile.weight) return;
    setProfile(tempProfile);
    // Initialize Chat with context
    setMessages([
        { role: "model", text: `${tempProfile.name}，数据我收到了。身高${tempProfile.height}，体重${tempProfile.weight}。别废话了，让我们看看能不能把你这身肉雕刻成艺术品！` }
    ]);
    // Generate initial plan
    await generateWorkoutPlan(tempProfile);
  };

  const toggleMusic = () => {
    setIsPlaying(!isPlaying);
  };

  const nextTrack = () => {
    // Just update index, useEffect handles the logic
    setCurrentTrackIndex((prev) => (prev + 1) % PLAYLIST.length);
  };

  const generateDailyQuote = async () => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: "给我一句简短的、极具力量的健身励志名言（心灵鸡汤），不要名人名言，要原创的、像教练吼出来的。",
            config: {
                maxOutputTokens: 50,
            }
        });
        if (response.text) setDailyQuote(response.text);
    } catch (e) {
        setDailyQuote("要么出众，要么出局。");
    }
  };

  const generateWorkoutPlan = async (userProfile: UserProfile) => {
    setLoadingPlan(true);
    setCompletedExercises(new Set());
    
    try {
        const bmi = (Number(userProfile.weight) / ((Number(userProfile.height)/100) ** 2)).toFixed(1);
        const prompt = `
        为一名身高${userProfile.height}cm，体重${userProfile.weight}kg (BMI: ${bmi}) 的${userProfile.level}学员制定腹肌训练计划。
        如果BMI>24，增加高强度间歇或全身燃脂动作。
        如果BMI<20，注重腹肌厚度训练。
        生成JSON格式。
        `;
        
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                systemInstruction: "你是一个专业的体能训练师。生成JSON格式的训练计划。",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING, description: "计划名称，根据BMI定制" },
                        difficulty: { type: Type.STRING },
                        focus: { type: Type.STRING, description: "训练重点，例如'强力燃脂'或'腹肌撕裂'" },
                        exercises: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING, description: "动作名称" },
                                    reps: { type: Type.STRING, description: "次数或时间" },
                                    notes: { type: Type.STRING, description: "针对该用户的动作要领" }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (response.text) {
            const planData = JSON.parse(response.text) as WorkoutPlan;
            setPlan(planData);
        }

    } catch (e) {
        console.error("Plan generation error", e);
        // Fallback or retry logic could go here
    } finally {
        setLoadingPlan(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userText = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setIsTyping(true);

    try {
      const chat = ai.chats.create({
        model: MODEL_NAME,
        config: {
          systemInstruction: getSystemInstruction(),
        },
        history: messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }))
      });

      const result = await chat.sendMessageStream({ message: userText });
      
      let fullResponse = "";
      setMessages((prev) => [...prev, { role: "model", text: "" }]); 

      for await (const chunk of result) {
        const text = chunk.text;
        if (text) {
            fullResponse += text;
            setMessages((prev) => {
                const newArr = [...prev];
                newArr[newArr.length - 1].text = fullResponse;
                return newArr;
            });
        }
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: "model", text: "网络断了，就像你的意志力一样需要加强链接！重试一次！" }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleExercise = (index: number) => {
    const newSet = new Set(completedExercises);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setCompletedExercises(newSet);

    // Congratulate if finished
    if (plan && newSet.size === plan.exercises.length && plan.exercises.length > 0) {
        setTimeout(() => {
             setMessages(prev => [...prev, {
                role: "model",
                text: `牛X！${profile?.name}！今天的计划全部搞定！感受到腹肌在尖叫了吗？那就是生长的声音！保持住！`
            }]);
            setActiveTab("chat");
        }, 500);
    }
  };

  // --- Render: Onboarding ---
  if (!profile) {
    return (
        <div className="min-h-screen bg-gym-black text-white p-6 flex flex-col justify-center max-w-md mx-auto relative overflow-hidden">
            {/* Background Accents */}
            <div className="absolute top-[-20%] left-[-20%] w-[300px] h-[300px] bg-gym-gold/20 rounded-full blur-[100px]" />
            
            <div className="relative z-10">
                <div className="mb-8">
                    <h1 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-gym-gold to-yellow-200 mb-2">
                        腹肌工厂
                    </h1>
                    <p className="text-gray-400">量身定制你的蜕变计划</p>
                </div>

                <form onSubmit={handleProfileSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">昵称</label>
                        <input 
                            type="text" 
                            value={tempProfile.name}
                            onChange={(e) => setTempProfile({...tempProfile, name: e.target.value})}
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-lg focus:border-gym-gold focus:outline-none transition-colors"
                        />
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm text-gray-400 mb-2">身高 (cm)</label>
                            <input 
                                type="number" 
                                placeholder="175"
                                value={tempProfile.height}
                                onChange={(e) => setTempProfile({...tempProfile, height: e.target.value})}
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-lg focus:border-gym-gold focus:outline-none transition-colors"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm text-gray-400 mb-2">体重 (kg)</label>
                            <input 
                                type="number" 
                                placeholder="70"
                                value={tempProfile.weight}
                                onChange={(e) => setTempProfile({...tempProfile, weight: e.target.value})}
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-lg focus:border-gym-gold focus:outline-none transition-colors"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">当前基础</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(["初学者", "中级", "大神"] as const).map(l => (
                                <button
                                    key={l}
                                    type="button"
                                    onClick={() => setTempProfile({...tempProfile, level: l})}
                                    className={`p-3 rounded-xl text-sm font-bold border transition-all ${
                                        tempProfile.level === l 
                                        ? 'bg-gym-gold text-black border-gym-gold' 
                                        : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
                                    }`}
                                >
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={!tempProfile.height || !tempProfile.weight}
                        className="w-full bg-gradient-to-r from-gym-gold to-yellow-600 text-black font-black text-xl py-4 rounded-xl shadow-lg shadow-yellow-900/40 active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        生成计划 <ArrowRight strokeWidth={3} size={20} />
                    </button>
                </form>
            </div>
        </div>
    );
  }

  // --- Render: Main App ---
  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-gym-black shadow-2xl overflow-hidden relative border-x border-gym-dark">
      
      {/* Header */}
      <header className="bg-gym-dark p-4 flex items-center justify-between border-b border-gray-800 z-10">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gym-gold to-yellow-600 flex items-center justify-center text-black font-bold text-xl shadow-lg shadow-yellow-900/20">
                {profile.name[0]}
            </div>
            <div>
                <h1 className="text-white font-bold text-lg leading-tight">腹肌工厂</h1>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                    {profile.height}cm / {profile.weight}kg
                </p>
            </div>
        </div>
        
        {/* Music Player Control */}
        <div className="flex items-center gap-2 bg-gray-900 rounded-full p-1 border border-gray-800">
            <button 
                onClick={toggleMusic}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-gym-accent text-black animate-pulse' : 'bg-gray-800 text-gray-400'}`}>
                {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            </button>
            <div 
                onClick={nextTrack}
                className="pr-3 pl-1 text-xs font-medium text-gray-400 cursor-pointer hover:text-white max-w-[80px] truncate">
                {isPlaying ? (
                     <div className="flex gap-0.5 items-end h-3">
                        <span className="w-0.5 h-full bg-gym-gold animate-[bounce_1s_infinite]"></span>
                        <span className="w-0.5 h-2/3 bg-gym-gold animate-[bounce_1.2s_infinite]"></span>
                        <span className="w-0.5 h-full bg-gym-gold animate-[bounce_0.8s_infinite]"></span>
                    </div>
                ) : <Music size={14} />}
            </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-800 bg-gym-black">
            <button 
                onClick={() => setActiveTab("plan")}
                className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'plan' ? 'text-gym-gold border-b-2 border-gym-gold bg-gray-900/50' : 'text-gray-500 hover:text-gray-300'}`}>
                <Dumbbell size={18} />
                今日计划
            </button>
            <button 
                onClick={() => setActiveTab("chat")}
                className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'chat' ? 'text-gym-gold border-b-2 border-gym-gold bg-gray-900/50' : 'text-gray-500 hover:text-gray-300'}`}>
                <MessageSquare size={18} />
                AI 私教
            </button>
        </div>

        {/* Tab Content: Plan */}
        {activeTab === "plan" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Daily Quote Card */}
                <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Quote size={80} />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-gym-gold text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1">
                           <Sparkles size={12} /> 今日精神氮泵
                        </h2>
                        <p className="text-white text-lg font-serif italic leading-relaxed">
                            “{dailyQuote}”
                        </p>
                    </div>
                </div>

                {/* The Plan Card */}
                <div className="bg-gym-dark rounded-xl border border-gray-800 overflow-hidden mb-4">
                    <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                        <div>
                            <h3 className="text-white font-bold text-lg">{plan ? plan.title : "分析身体数据中..."}</h3>
                            <div className="flex gap-2 mt-1">
                                <span className="text-[10px] text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">
                                    {plan ? plan.difficulty : "--"}
                                </span>
                                <span className="text-[10px] text-gym-accent bg-green-900/20 px-1.5 py-0.5 rounded border border-green-900">
                                    {plan ? plan.focus : "--"}
                                </span>
                            </div>
                        </div>
                        <button 
                            onClick={() => generateWorkoutPlan(profile)}
                            disabled={loadingPlan}
                            className="text-gym-gold hover:text-white transition-colors p-2 rounded-full hover:bg-gray-800 disabled:opacity-50">
                            <RotateCcw size={18} className={loadingPlan ? "animate-spin" : ""} />
                        </button>
                    </div>
                    
                    <div className="p-2">
                        {loadingPlan ? (
                            <div className="py-12 text-center text-gray-500 flex flex-col items-center gap-3">
                                <span className="animate-spin text-gym-gold"><Zap size={32} /></span>
                                <p className="text-sm">AI 正在根据你的BMI计算最佳动作...</p>
                            </div>
                        ) : plan && plan.exercises.length > 0 ? (
                            <div className="space-y-1">
                                {plan.exercises.map((ex, idx) => (
                                    <div 
                                        key={idx}
                                        onClick={() => toggleExercise(idx)}
                                        className={`p-3 rounded-lg flex items-start gap-3 cursor-pointer transition-all ${completedExercises.has(idx) ? 'bg-green-900/10 opacity-60' : 'hover:bg-gray-800'}`}>
                                        <div className={`mt-1 transition-colors ${completedExercises.has(idx) ? 'text-gym-accent' : 'text-gray-600'}`}>
                                            {completedExercises.has(idx) ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <div className={`font-bold text-base ${completedExercises.has(idx) ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                                                    {ex.name}
                                                </div>
                                                <div className="text-gym-gold font-mono font-bold text-sm bg-yellow-900/20 px-2 py-0.5 rounded">
                                                    {ex.reps}
                                                </div>
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1 leading-snug">{ex.notes}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-500">
                                <button onClick={() => generateWorkoutPlan(profile)} className="text-gym-gold underline">
                                    重新生成计划
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {plan && (
                        <div className="bg-gray-900/80 p-3 text-center border-t border-gray-800">
                            <div className="flex justify-between text-xs text-gray-400 mb-2 px-1">
                                <span>进度</span>
                                <span>{Math.round((completedExercises.size / plan.exercises.length) * 100)}%</span>
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                                <div 
                                    className="bg-gradient-to-r from-gym-gold to-yellow-600 h-full transition-all duration-500 shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                                    style={{ width: `${(completedExercises.size / plan.exercises.length) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Tab Content: Chat */}
        {activeTab === "chat" && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && (
                                <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center mr-2 mt-1">
                                    <Zap size={14} className="text-gym-gold" fill="currentColor" />
                                </div>
                            )}
                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md ${
                                msg.role === 'user' 
                                ? 'bg-gym-gold text-black rounded-tr-none' 
                                : 'bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700'
                            }`}>
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                         <div className="flex justify-start ml-10">
                            <div className="bg-gray-800 text-gray-400 px-4 py-3 rounded-2xl rounded-tl-none border border-gray-700 text-xs flex gap-1 items-center">
                                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-100"></span>
                                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-200"></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                
                {/* Chat Input */}
                <div className="p-4 bg-gym-black border-t border-gray-800">
                    <div className="flex gap-2 relative">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="问教练关于饮食、动作..."
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-full px-4 py-3 text-white text-sm focus:outline-none focus:border-gym-gold transition-colors placeholder-gray-600"
                        />
                        <button 
                            onClick={handleSendMessage}
                            disabled={!input.trim() || isTyping}
                            className="bg-gym-gold hover:bg-gym-gold-hover disabled:opacity-50 disabled:cursor-not-allowed text-black p-3 rounded-full transition-transform active:scale-95 flex items-center justify-center">
                            <Send size={18} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            </div>
        )}

      </main>
    </div>
  );
};

const root = createRoot(document.getElementById("root"));
root.render(<App />);