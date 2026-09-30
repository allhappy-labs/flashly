import {
    Check,
    ChevronsUpDown,
    BookOpen,
    Languages,
    Stethoscope,
    Code2,
    Calculator,
    Atom,
    Beaker,
    Microscope,
    Landmark,
    Globe,
    Brain,
    TrendingUp,
    Scale,
    Briefcase,
    Music,
    Palette,
    Cog,
    Database,
    Scroll,
    Library,
    Users,
    Building2,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/utils/style-utils';
import {
    FLASHCARD_MATERIAL_TYPE_GROUPS,
    FLASHCARD_MATERIAL_TYPE_ICON_KEYS,
    FLASHCARD_MATERIAL_TYPE_TRANSLATION_KEYS,
    type FlashcardMaterialType,
    type FlashcardMaterialTypeIconKey,
} from '@flashly/shared/src';

const LUCIDE_ICON_BY_KEY: Record<FlashcardMaterialTypeIconKey, React.ComponentType<{ className?: string }>> = {
    'book-open': BookOpen,
    languages: Languages,
    stethoscope: Stethoscope,
    'code-2': Code2,
    calculator: Calculator,
    atom: Atom,
    beaker: Beaker,
    microscope: Microscope,
    landmark: Landmark,
    globe: Globe,
    brain: Brain,
    'trending-up': TrendingUp,
    scale: Scale,
    briefcase: Briefcase,
    music: Music,
    palette: Palette,
    cog: Cog,
    database: Database,
    'scroll-text': Scroll,
    library: Library,
    users: Users,
    'building-2': Building2,
};

function getMaterialIcon(materialType: FlashcardMaterialType): React.ComponentType<{ className?: string }> {
    const iconKey = FLASHCARD_MATERIAL_TYPE_ICON_KEYS[materialType];
    return LUCIDE_ICON_BY_KEY[iconKey];
}

interface MaterialTypeOption {
    value: FlashcardMaterialType;
    label: string;
    category: string;
}

interface MaterialTypeComboboxProps {
    id?: string;
    value: FlashcardMaterialType;
    onChange: (value: FlashcardMaterialType) => void;
    disabled?: boolean;
    portalled?: boolean;
}

export function MaterialTypeCombobox({
    id,
    value,
    onChange,
    disabled = false,
    portalled = true,
}: MaterialTypeComboboxProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Build options array with translations
    const allOptions: MaterialTypeOption[] = useMemo(() => {
        return Object.entries(FLASHCARD_MATERIAL_TYPE_GROUPS).flatMap(([category, types]) =>
            types.map((type) => ({
                value: type as FlashcardMaterialType,
                label: t(`web.flashcards.material.${FLASHCARD_MATERIAL_TYPE_TRANSLATION_KEYS[type]}`),
                category,
            }))
        );
    }, [t]);

    // Filter options by search query
    const filteredOptions = useMemo(() => {
        if (!searchQuery) return allOptions;
        const query = searchQuery.toLowerCase();
        return allOptions.filter(
            (option) => option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query)
        );
    }, [searchQuery, allOptions]);

    // Group filtered options by category
    const groupedOptions = useMemo(() => {
        const groups: Record<string, MaterialTypeOption[]> = {};
        filteredOptions.forEach((option) => {
            if (!groups[option.category]) groups[option.category] = [];
            groups[option.category].push(option);
        });
        return groups;
    }, [filteredOptions]);

    const handleSelect = (newValue: FlashcardMaterialType) => {
        onChange(newValue);
        setOpen(false);
        setSearchQuery('');
    };

    const selectedOption = allOptions.find((opt) => opt.value === value);
    const displayValue = selectedOption?.label || '';
    const SelectedIcon = value ? getMaterialIcon(value) : null;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn('w-full justify-between', !displayValue && 'text-muted-foreground')}
                    disabled={disabled}
                >
                    <div className="flex items-center gap-2">
                        {SelectedIcon && <SelectedIcon className="h-4 w-4" />}
                        {displayValue || 'Select material type...'}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full max-h-[360px] overflow-y-auto p-0" align="start" portalled={portalled}>
                <div className="sticky top-0 z-10 border-b bg-popover p-2">
                    <Input
                        placeholder="Search material types..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9"
                    />
                </div>
                <div className="p-1">
                    {Object.entries(groupedOptions).map(([category, options]) => (
                        <div key={category}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                {category}
                            </div>
                            {options.map((option) => {
                                const Icon = getMaterialIcon(option.value);
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={cn(
                                            'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden hover:bg-primary-soft hover:text-primary-foreground',
                                            value === option.value && 'bg-primary text-primary-foreground'
                                        )}
                                        onClick={() => handleSelect(option.value)}
                                    >
                                        <Icon className="h-4 w-4" />
                                        <span className="flex-1 text-left">{option.label}</span>
                                        <Check className={cn('h-4 w-4', value === option.value ? 'opacity-100' : 'opacity-0')} />
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                    {filteredOptions.length === 0 && (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                            No material types found.
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
