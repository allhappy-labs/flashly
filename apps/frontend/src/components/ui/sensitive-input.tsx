import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { cn } from '@/utils/style-utils';
import { Input } from '@/components/ui/input';

type SensitiveInputProps = Omit<ComponentProps<'input'>, 'type'> & {
    containerClassName?: string;
    defaultVisible?: boolean;
};

export function SensitiveInput({
    className,
    containerClassName,
    defaultVisible = false,
    ...props
}: SensitiveInputProps) {
    const [isVisible, setIsVisible] = useState(defaultVisible);

    return (
        <div className={cn('relative', containerClassName)}>
            <Input
                {...props}
                type={isVisible ? 'text' : 'password'}
                className={cn('pr-10', className)}
            />
            <button
                type="button"
                onClick={() => setIsVisible((value) => !value)}
                aria-label={isVisible ? 'Hide value' : 'Show value'}
                aria-pressed={isVisible}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
            >
                {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
        </div>
    );
}
