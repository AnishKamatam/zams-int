"use client";

import { useState } from "react";
import { Plus, Mic, Send } from "lucide-react";

export default function Home() {
  const [inputValue, setInputValue] = useState("");

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center px-4 pt-8">
      {/* Main content centered */}
      <div className="flex flex-col items-center space-y-12 w-full max-w-3xl">
        {/* "Ready when you are" text */}
        <h1 className="text-black text-4xl font-light text-center">
          Ready when you are.
        </h1>

        {/* Input field container */}
        <div className="w-full relative">
          <div className="bg-white rounded-2xl px-4 py-3 flex items-center space-x-3 w-full shadow-sm border border-gray-200">
            {/* Plus icon */}
            <button className="text-gray-600 text-xl font-light cursor-pointer hover:text-gray-800 transition-colors">
              <Plus size={20} />
            </button>
            
            {/* Input field */}
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask anything"
              className="flex-1 bg-transparent text-black placeholder-gray-500 outline-none text-lg"
            />
            
            {/* Action buttons */}
            <div className="flex items-center space-x-3">
              {/* Microphone icon */}
              <button className="text-gray-600 hover:text-gray-800 transition-colors">
                <Mic size={20} />
              </button>
              
              {/* Send icon */}
              <button className="text-gray-600 hover:text-gray-800 transition-colors">
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
