import React from 'react';
import { cn } from '@/lib/utils';

interface LinkifyTextProps {
  text: string;
  className?: string;
  linkClassName?: string;
}

export function LinkifyText({ text, className, linkClassName }: LinkifyTextProps) {
  if (!text) return null;

  // Regex to detect URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return (
    <p className={className}>
      {parts.map((part, i) => {
        if (part.match(urlRegex)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className={cn("text-primary hover:underline font-medium", linkClassName)}
              onClick={(e) => e.stopPropagation()} // Prevent parent components (like notification items) from triggering their onClick
            >
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}
