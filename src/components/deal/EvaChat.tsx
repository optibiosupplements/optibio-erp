"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot, User, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface EvaChatProps {
  context: {
    productName?: string;
    dosageForm?: string;
    servingSize?: string;
    servingsPerContainer?: string;
    moq?: string;
    bulkOrPackaged?: string;
    specialRequirements?: string;
    ingredientNames?: string[];
    activeIngredients?: { name: string; amount: number; unit: string; notes?: string; inDb?: boolean }[];
    excipients?: string[];
  };
  onSuggestion?: (suggestion: string) => void;
}

export default function EvaChat({ context, onSuggestion }: EvaChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize Eva with context on first render
  useEffect(() => {
    if (!initialized && context.productName) {
      setInitialized(true);
      sendToEva([], true);
    }
  }, [context.productName]);

  const sendToEva = async (conversationMessages: Message[], isInitial = false) => {
    setLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: isInitial ? [] : conversationMessages,
          context,
        }),
      });
      const data = await res.json();

      if (data.success) {
        const newMessages = isInitial
          ? [{ role: "assistant" as const, content: data.reply }]
          : [...conversationMessages, { role: "assistant" as const, content: data.reply }];
        setMessages(newMessages);
      } else {
        setMessages([
          ...conversationMessages,
          { role: "assistant" as const, content: `Error: ${data.error}. Please check your Anthropic API credits.` },
        ]);
      }
    } catch (err: any) {
      setMessages([
        ...conversationMessages,
        { role: "assistant" as const, content: `Connection error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || loading) return;
    const newMessages: Message[] = [...messages, { role: "user", content: input.trim() }];
    setMessages(newMessages);
    setInput("");
    sendToEva(newMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col" style={{ height: "500px" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="p-1.5 rounded-lg bg-purple-100">
          <Bot className="h-4 w-4 text-purple-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Eva — Formulation Specialist</h3>
          <p className="text-[10px] text-gray-500">AI-powered dietary supplement formulation expert</p>
        </div>
        {loading && <Loader2 className="h-3 w-3 text-purple-500 animate-spin ml-auto" />}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="text-center py-8">
            <Sparkles className="h-8 w-8 text-purple-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Eva will review your formulation and provide expert recommendations.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="shrink-0 p-1.5 rounded-lg bg-purple-100 h-fit mt-0.5">
                <Bot className="h-3 w-3 text-purple-600" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-[#d10a11] text-white rounded-br-md"
                : "bg-gray-50 text-gray-800 rounded-bl-md"
            }`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
            {msg.role === "user" && (
              <div className="shrink-0 p-1.5 rounded-lg bg-gray-100 h-fit mt-0.5">
                <User className="h-3 w-3 text-gray-500" />
              </div>
            )}
          </div>
        ))}

        {loading && messages.length > 0 && (
          <div className="flex gap-3">
            <div className="shrink-0 p-1.5 rounded-lg bg-purple-100 h-fit">
              <Bot className="h-3 w-3 text-purple-600" />
            </div>
            <div className="bg-gray-50 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Eva is thinking...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Eva about the formulation..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300"
            style={{ minHeight: "40px", maxHeight: "100px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="shrink-0 p-2.5 rounded-xl bg-[#d10a11] text-white hover:bg-[#a30a0f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5">Press Enter to send, Shift+Enter for new line</p>
      </div>
    </div>
  );
}
