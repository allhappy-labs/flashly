import { Check, ChevronsUpDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/utils/style-utils';

type ElevenLabsLanguage = {
    name: string;
    code: string;
};

// Mapping of language codes to country flag emojis
const LANGUAGE_FLAGS: Record<string, string> = {
    afr: '🇿🇦', // Afrikaans - South Africa
    ara: '🇸🇦', // Arabic - Saudi Arabia
    hye: '🇦🇲', // Armenian - Armenia
    asm: '🇮🇳', // Assamese - India
    aze: '🇦🇿', // Azerbaijani - Azerbaijan
    bel: '🇧🇾', // Belarusian - Belarus
    ben: '🇧🇩', // Bengali - Bangladesh
    bos: '🇧🇦', // Bosnian - Bosnia
    bul: '🇧🇬', // Bulgarian - Bulgaria
    cat: '🇪🇸', // Catalan - Spain
    ceb: '🇵🇭', // Cebuano - Philippines
    nya: '🇲🇼', // Chichewa - Malawi
    hrv: '🇭🇷', // Croatian - Croatia
    ces: '🇨🇿', // Czech - Czech Republic
    dan: '🇩🇰', // Danish - Denmark
    nld: '🇳🇱', // Dutch - Netherlands
    eng: '🇬🇧', // English - United Kingdom
    est: '🇪🇪', // Estonian - Estonia
    fil: '🇵🇭', // Filipino - Philippines
    fin: '🇫🇮', // Finnish - Finland
    fra: '🇫🇷', // French - France
    glg: '🇪🇸', // Galician - Spain
    kat: '🇬🇪', // Georgian - Georgia
    deu: '🇩🇪', // German - Germany
    ell: '🇬🇷', // Greek - Greece
    guj: '🇮🇳', // Gujarati - India
    hau: '🇳🇬', // Hausa - Nigeria
    heb: '🇮🇱', // Hebrew - Israel
    hin: '🇮🇳', // Hindi - India
    hun: '🇭🇺', // Hungarian - Hungary
    isl: '🇮🇸', // Icelandic - Iceland
    ind: '🇮🇩', // Indonesian - Indonesia
    gle: '🇮🇪', // Irish - Ireland
    ita: '🇮🇹', // Italian - Italy
    jpn: '🇯🇵', // Japanese - Japan
    jav: '🇮🇩', // Javanese - Indonesia
    kan: '🇮🇳', // Kannada - India
    kaz: '🇰🇿', // Kazakh - Kazakhstan
    kir: '🇰🇬', // Kirghiz - Kyrgyzstan
    kor: '🇰🇷', // Korean - South Korea
    lav: '🇱🇻', // Latvian - Latvia
    lin: '🇨🇩', // Lingala - DRC
    lit: '🇱🇹', // Lithuanian - Lithuania
    ltz: '🇱🇺', // Luxembourgish - Luxembourg
    mkd: '🇲🇰', // Macedonian - North Macedonia
    msa: '🇲🇾', // Malay - Malaysia
    mal: '🇮🇳', // Malayalam - India
    cmn: '🇨🇳', // Mandarin Chinese - China
    mar: '🇮🇳', // Marathi - India
    nep: '🇳🇵', // Nepali - Nepal
    nor: '🇳🇴', // Norwegian - Norway
    pus: '🇦🇫', // Pashto - Afghanistan
    fas: '🇮🇷', // Persian - Iran
    pol: '🇵🇱', // Polish - Poland
    por: '🇧🇷', // Portuguese - Brazil
    pan: '🇮🇳', // Punjabi - India
    ron: '🇷🇴', // Romanian - Romania
    rus: '🇷🇺', // Russian - Russia
    srp: '🇷🇸', // Serbian - Serbia
    snd: '🇵🇰', // Sindhi - Pakistan
    slk: '🇸🇰', // Slovak - Slovakia
    slv: '🇸🇮', // Slovenian - Slovenia
    som: '🇸🇴', // Somali - Somalia
    spa: '🇪🇸', // Spanish - Spain
    swa: '🇰🇪', // Swahili - Kenya
    swe: '🇸🇪', // Swedish - Sweden
    tam: '🇮🇳', // Tamil - India
    tel: '🇮🇳', // Telugu - India
    tha: '🇹🇭', // Thai - Thailand
    tur: '🇹🇷', // Turkish - Turkey
    ukr: '🇺🇦', // Ukrainian - Ukraine
    urd: '🇵🇰', // Urdu - Pakistan
    vie: '🇻🇳', // Vietnamese - Vietnam
    cym: '🇬🇧', // Welsh - United Kingdom
};

export function getFlagEmoji(code: string): string {
    return LANGUAGE_FLAGS[code] || '🌐';
}

type LanguageComboboxProps = {
    id?: string;
    value?: string;
    onChange: (value: string | undefined) => void;
    placeholder?: string;
    disabled?: boolean;
    portalled?: boolean;
    languages: ElevenLabsLanguage[];
    allowEmpty?: boolean;
    emptyLabel?: string;
};

export function LanguageCombobox({
    id,
    value,
    onChange,
    placeholder = 'Select language...',
    disabled = false,
    portalled = true,
    languages,
    allowEmpty = false,
    emptyLabel = 'Auto-detect',
}: LanguageComboboxProps) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const selectedLanguage = useMemo(() => {
        if (!value) return null;
        return languages.find((lang) => lang.code === value);
    }, [value, languages]);

    const filteredLanguages = useMemo(() => {
        if (!searchQuery) return languages;
        const query = searchQuery.toLowerCase();
        return languages.filter(
            (lang) => lang.name.toLowerCase().includes(query) || lang.code.toLowerCase().includes(query),
        );
    }, [searchQuery, languages]);

    const handleSelect = (code: string | undefined) => {
        onChange(code);
        setOpen(false);
        setSearchQuery('');
    };

    const displayValue = selectedLanguage?.name || (allowEmpty && !value ? emptyLabel : '');
    const selectedFlag = selectedLanguage?.code ? getFlagEmoji(selectedLanguage.code) : null;

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
                        {selectedFlag && (
                            <span className="text-sm" role="img" aria-label="Flag">
                                {selectedFlag}
                            </span>
                        )}
                        {displayValue || placeholder}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full max-h-[320px] overflow-y-auto p-0" align="start" portalled={portalled}>
                <div className="sticky top-0 z-10 border-b bg-popover p-2">
                    <Input
                        placeholder="Search languages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9"
                    />
                </div>
                <div className="p-1">
                    {allowEmpty && (
                        <button
                            type="button"
                            className={cn(
                                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden hover:bg-primary-soft hover:text-primary-foreground',
                                !value && 'bg-primary text-primary-foreground',
                            )}
                            onClick={() => handleSelect(undefined)}
                        >
                            <span className="flex-1 text-left">{emptyLabel}</span>
                            <Check className={cn('h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                        </button>
                    )}
                    {filteredLanguages.map((language) => (
                        <button
                            key={language.code}
                            type="button"
                            className={cn(
                                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden hover:bg-primary-soft hover:text-primary-foreground',
                                value === language.code && 'bg-primary text-primary-foreground',
                            )}
                            onClick={() => handleSelect(language.code)}
                        >
                            <span className="text-sm" role="img" aria-label={`Flag for ${language.name}`}>
                                {getFlagEmoji(language.code)}
                            </span>
                            <span className="flex-1 text-left">{language.name}</span>
                            <Check className={cn('h-4 w-4', value === language.code ? 'opacity-100' : 'opacity-0')} />
                        </button>
                    ))}
                    {filteredLanguages.length === 0 && (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                            No languages found.
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
