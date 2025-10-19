import React, { useState } from 'react';

export function Composer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim()) {
      onSend(text.trim());
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div>
      <textarea
        className="w-full outline-none resize-none text-slate-700 border border-slate-200 rounded-lg p-3"
        rows={3}
        placeholder="Type your message... (Cmd/Ctrl + Enter to send, or Enter)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        disabled={disabled}
      />
      <div className="flex justify-end gap-2 mt-2">
        <button
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors shadow-sm"
          onClick={handleSend}
          disabled={disabled || !text.trim()}
        >
          Send Message
        </button>
      </div>
    </div>
  );
}
