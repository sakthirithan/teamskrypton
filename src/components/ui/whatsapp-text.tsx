import React from 'react';

interface WhatsAppTextProps {
  text: string;
  className?: string;
}

export function parseWhatsAppFormatting(input: string): React.ReactNode[] {
  if (!input) return [];

  const lines = input.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    const isBullet = /^\s*[-*]\s+(.+)/.exec(line);
    const isNumbered = /^\s*\d+\.\s+(.+)/.exec(line);

    let contentToParse = line;
    let isListItem = false;
    let listType: 'bullet' | 'numbered' = 'bullet';

    if (isBullet) {
      contentToParse = isBullet[1];
      isListItem = true;
      listType = 'bullet';
    } else if (isNumbered) {
      contentToParse = isNumbered[1];
      isListItem = true;
      listType = 'numbered';
    }

    const inlineNodes = parseInlineFormatting(contentToParse);

    if (isListItem) {
      elements.push(
        <li
          key={`line-${lineIdx}`}
          className={`ml-5 py-0.5 text-sm ${
            listType === 'bullet' ? 'list-disc' : 'list-decimal'
          }`}
        >
          {inlineNodes}
        </li>
      );
    } else {
      elements.push(
        <React.Fragment key={`line-${lineIdx}`}>
          {inlineNodes}
          {lineIdx < lines.length - 1 && <br />}
        </React.Fragment>
      );
    }
  });

  return elements;
}

function parseInlineFormatting(text: string): React.ReactNode[] {
  // Pattern matches: `code`, *bold*, _italic_, ~strike~
  const regex = /(`[^`]+`|\*[^*]+\*|_[^_]+_|~[^~]+~)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={index}
          className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs text-primary font-medium"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <strong key={index} className="font-bold">{part.slice(1, -1)}</strong>;
    }

    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return <em key={index} className="italic">{part.slice(1, -1)}</em>;
    }

    if (part.startsWith('~') && part.endsWith('~') && part.length > 2) {
      return <del key={index} className="line-through opacity-75">{part.slice(1, -1)}</del>;
    }

    return part;
  });
}

export function stripWhatsAppFormatting(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~([^~]+)~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .trim();
}

export function WhatsAppText({ text, className = '' }: WhatsAppTextProps) {
  if (!text) return null;
  return <div className={`whitespace-pre-wrap leading-relaxed ${className}`}>{parseWhatsAppFormatting(text)}</div>;
}
