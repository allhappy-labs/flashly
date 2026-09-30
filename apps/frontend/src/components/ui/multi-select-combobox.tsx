import { Check, ChevronsUpDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/style-utils';

type MultiSelectComboboxProps<T extends string> = {
    id?: string;
    value: T[];
    onChange: (value: T[]) => void;
    options: Array<{ value: T; label: string; disabled?: boolean }>;
    placeholder?: string;
    disabled?: boolean;
    requiredValues?: T[];
    maxDisplayItems?: number;
    searchPlaceholder?: string;
    emptyMessage?: string;
};

export function MultiSelectCombobox<T extends string>({
    id,
    value,
    onChange,
    options,
    placeholder = 'Select...',
    disabled = false,
    requiredValues = [],
    maxDisplayItems = 2,
    searchPlaceholder = 'Search...',
    emptyMessage = 'No results found.',
}: MultiSelectComboboxProps<T>) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const optionsMap = useMemo(() => {
        const map = new Map<T, string>();
        for (const opt of options) {
            map.set(opt.value, opt.label);
        }
        return map;
    }, [options]);

    const filteredOptions = useMemo(() => {
        if (!searchQuery) return options;
        const query = searchQuery.toLowerCase();
        return options.filter((opt) => opt.label.toLowerCase().includes(query));
    }, [searchQuery, options]);

    const handleToggle = (optionValue: T) => {
        const option = options.find((opt) => opt.value === optionValue);
        if (option?.disabled) return;

        if (value.includes(optionValue)) {
            // Don't allow removing required values
            if (requiredValues.includes(optionValue)) return;
            onChange(value.filter((v) => v !== optionValue));
        } else {
            onChange([...value, optionValue]);
        }
    };

    const displayValue = useMemo(() => {
        if (value.length === 0) return placeholder;

        const labels = value
            .map((v) => optionsMap.get(v))
            .filter((label): label is string => label !== undefined);

        if (labels.length <= maxDisplayItems) {
            return labels.join(', ');
        }

        const displayed = labels.slice(0, maxDisplayItems);
        const remaining = labels.length - maxDisplayItems;
        return `${displayed.join(', ')} +${remaining} more`;
    }, [value, optionsMap, maxDisplayItems, placeholder]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn('w-full justify-between font-normal', value.length === 0 && 'text-muted-foreground')}
                    disabled={disabled}
                >
                    <span className="truncate">{displayValue}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <div className="p-2">
                    <Input
                        placeholder={searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9"
                    />
                </div>
                <div className="max-h-[250px] overflow-y-auto p-1">
                    {filteredOptions.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
                    ) : (
                        filteredOptions.map((option) => {
                            const isSelected = value.includes(option.value);
                            const isRequired = requiredValues.includes(option.value);
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={cn(
                                        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden hover:bg-primary-soft hover:text-primary-foreground',
                                        isSelected && !isRequired && 'bg-primary text-primary-foreground',
                                        isRequired && 'opacity-70 cursor-default',
                                    )}
                                    onClick={() => handleToggle(option.value)}
                                    disabled={isRequired}
                                >
                                    <Check
                                        className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')}
                                    />
                                    <span className="flex-1 text-left">{option.label}</span>
                                    {isRequired && (
                                        <Badge variant="secondary" className="text-xs">
                                            Required
                                        </Badge>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
