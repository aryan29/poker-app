'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

interface Props {
  roomCode: string;
  userId: string | undefined;
  displayName: string | undefined;
}

export function Chat({ roomCode, userId, displayName }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load chat history from DB on mount
  useEffect(() => {
    const loadHistory = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_code', roomCode)
        .order('created_at', { ascending: true })
        .limit(50);

      if (data && data.length > 0) {
        setMessages(
          data.map((row) => ({
            id: row.id,
            userId: row.user_id,
            displayName: row.display_name,
            text: row.text,
            timestamp: new Date(row.created_at).getTime(),
          }))
        );
      }
    };

    loadHistory();
  }, [roomCode, supabase]);

  // Subscribe to new messages via Realtime postgres_changes
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            user_id: string;
            display_name: string;
            text: string;
            created_at: string;
          };
          const msg: ChatMessage = {
            id: row.id,
            userId: row.user_id,
            displayName: row.display_name,
            text: row.text,
            timestamp: new Date(row.created_at).getTime(),
          };
          setMessages((prev) => {
            // Deduplicate in case of double-fire
            if (prev.some((m) => m.id === msg.id)) return prev;
            const updated = [...prev, msg];
            return updated.slice(-50);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, supabase]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !userId || !displayName) return;

    setInput('');

    // Persist to DB — Realtime will deliver it to all subscribers including sender
    await supabase.from('chat_messages').insert({
      room_code: roomCode,
      user_id: userId,
      display_name: displayName,
      text,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(0,0,0,0.2)',
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full bg-emerald-400"
            style={{ boxShadow: '0 0 6px #34d399' }}
          />
          <span className="text-sm font-semibold text-gray-200">Table Chat</span>
        </div>
        <span className="text-gray-500 text-xs">{collapsed ? '▲' : '▼'}</span>
      </div>

      {!collapsed && (
        <>
          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1.5"
            style={{ minHeight: 0 }}
          >
            {messages.length === 0 && (
              <div className="text-center text-gray-600 text-xs py-4">
                No messages yet
              </div>
            )}
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} isMe={msg.userId === userId} />
            ))}
          </div>

          {/* Input */}
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{
              borderTop: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(0,0,0,0.2)',
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Say something…"
              maxLength={200}
              className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 outline-none py-1"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all disabled:opacity-30"
              style={{
                background: 'linear-gradient(135deg, #059669, #047857)',
                color: '#fff',
                border: '1px solid rgba(52,211,153,0.3)',
              }}
            >
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ChatBubble({
  message,
  isMe,
}: {
  message: ChatMessage;
  isMe: boolean;
}) {
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
      <span className="text-xs text-gray-500">
        {isMe ? 'You' : message.displayName}
      </span>
      <div
        className="max-w-[85%] px-3 py-1.5 rounded-2xl text-sm leading-snug break-words"
        style={
          isMe
            ? {
                background: 'linear-gradient(135deg, #064e3b, #065f46)',
                color: '#d1fae5',
                borderBottomRightRadius: '4px',
                border: '1px solid rgba(52,211,153,0.2)',
              }
            : {
                background: 'rgba(255,255,255,0.07)',
                color: '#e5e7eb',
                borderBottomLeftRadius: '4px',
                border: '1px solid rgba(255,255,255,0.08)',
              }
        }
      >
        {message.text}
      </div>
      <span className="text-gray-700" style={{ fontSize: '10px' }}>
        {time}
      </span>
    </div>
  );
}
