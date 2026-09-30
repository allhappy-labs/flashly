import * as React from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/utils/style-utils';

function parseDelimitedTokens(value: string): string[] {
  return value
    .split(/[;,]/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function getCurrentDelimitedSegment(value: string): { query: string; prefix: string } {
  const lastCommaIndex = value.lastIndexOf(',');
  const lastSemicolonIndex = value.lastIndexOf(';');
  const separatorIndex = Math.max(lastCommaIndex, lastSemicolonIndex);

  if (separatorIndex < 0) {
    return { query: value.trim(), prefix: '' };
  }

  const prefixBase = value.slice(0, separatorIndex + 1);
  const prefix = /\s$/.test(prefixBase) ? prefixBase : `${prefixBase} `;

  return {
    query: value.slice(separatorIndex + 1).trim(),
    prefix,
  };
}

function buildNextDelimitedValue(value: string, selected: string): string {
  const { prefix } = getCurrentDelimitedSegment(value);
  return `${prefix}${selected}`;
}

export interface AutocompleteTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions: readonly string[];
  disabled?: boolean;
  multipleTokens?: boolean;
  className?: string;
}

export function AutocompleteTextInput({
  value,
  onChange,
  placeholder,
  suggestions,
  disabled = false,
  multipleTokens = false,
  className,
}: AutocompleteTextInputProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const closeTimeoutRef = React.useRef<number | null>(null);

  const activeQuery = multipleTokens ? getCurrentDelimitedSegment(value).query : value.trim();
  const selectedTokenSet = React.useMemo(() => {
    if (!multipleTokens) {
      return new Set<string>();
    }

    return new Set(parseDelimitedTokens(value).map((token) => token.toLowerCase()));
  }, [multipleTokens, value]);

  const filteredSuggestions = React.useMemo(() => {
    const normalizedQuery = activeQuery.toLowerCase();

    return suggestions.filter((suggestion) => {
      const normalizedSuggestion = suggestion.toLowerCase();
      const matchesQuery =
        normalizedQuery.length === 0 || normalizedSuggestion.includes(normalizedQuery);

      if (!matchesQuery) {
        return false;
      }

      if (!multipleTokens) {
        return true;
      }

      if (normalizedSuggestion === normalizedQuery) {
        return true;
      }

      return !selectedTokenSet.has(normalizedSuggestion);
    });
  }, [activeQuery, multipleTokens, selectedTokenSet, suggestions]);

  const showSuggestions = isOpen && !disabled && filteredSuggestions.length > 0;

  const clearPendingClose = React.useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleSelect = (selected: string) => {
    onChange(multipleTokens ? buildNextDelimitedValue(value, selected) : selected);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          if (!isOpen) {
            setIsOpen(true);
          }
        }}
        onFocus={() => {
          clearPendingClose();
          setIsOpen(true);
        }}
        onBlur={() => {
          clearPendingClose();
          closeTimeoutRef.current = window.setTimeout(() => {
            setIsOpen(false);
            closeTimeoutRef.current = null;
          }, 120);
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />

      {showSuggestions && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-50 rounded-md border bg-popover p-1 shadow-md">
          <div className="max-h-48 overflow-y-auto">
            {filteredSuggestions.slice(0, 8).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className={cn(
                  'flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-primary-soft hover:text-primary-foreground',
                  value.trim().toLowerCase() === suggestion.toLowerCase() && !multipleTokens && 'bg-primary text-primary-foreground',
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => handleSelect(suggestion)}
              >
                <span className="truncate">{suggestion}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
