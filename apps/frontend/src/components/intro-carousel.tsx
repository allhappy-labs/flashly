import { type MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Autoplay from 'embla-carousel-autoplay';
import useEmblaCarousel from 'embla-carousel-react';
import { BriefcaseBusiness, ChevronLeft, ChevronRight, GraduationCap, Languages, Sparkles, Target, Users, WandSparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/style-utils';

const AUTOPLAY_DELAY_MS = 6000;
const SLIDE_ICON_ACCENT_CLASS_NAME = 'bg-primary/10 text-primary';

type Persona = {
    audienceKey: string;
    benefitKey: string;
    icon: LucideIcon;
};

type Slide = {
    key: string;
    titleKey: string;
    descriptionKey: string;
    icon: LucideIcon;
    accentClassName: string;
    personas: Persona[];
};

const SLIDES: Slide[] = [
    {
        key: 'create',
        titleKey: 'web.auth.carousel.slides.create.title',
        descriptionKey: 'web.auth.carousel.slides.create.description',
        icon: WandSparkles,
        accentClassName: SLIDE_ICON_ACCENT_CLASS_NAME,
        personas: [
            {
                audienceKey: 'web.auth.carousel.slides.create.personas.students.audience',
                benefitKey: 'web.auth.carousel.slides.create.personas.students.benefit',
                icon: GraduationCap,
            },
            {
                audienceKey: 'web.auth.carousel.slides.create.personas.languageLearners.audience',
                benefitKey: 'web.auth.carousel.slides.create.personas.languageLearners.benefit',
                icon: Languages,
            },
            {
                audienceKey: 'web.auth.carousel.slides.create.personas.selfLearners.audience',
                benefitKey: 'web.auth.carousel.slides.create.personas.selfLearners.benefit',
                icon: Sparkles,
            },
        ],
    },
    {
        key: 'recall',
        titleKey: 'web.auth.carousel.slides.recall.title',
        descriptionKey: 'web.auth.carousel.slides.recall.description',
        icon: Target,
        accentClassName: SLIDE_ICON_ACCENT_CLASS_NAME,
        personas: [
            {
                audienceKey: 'web.auth.carousel.slides.recall.personas.examPrep.audience',
                benefitKey: 'web.auth.carousel.slides.recall.personas.examPrep.benefit',
                icon: GraduationCap,
            },
            {
                audienceKey: 'web.auth.carousel.slides.recall.personas.professionals.audience',
                benefitKey: 'web.auth.carousel.slides.recall.personas.professionals.benefit',
                icon: BriefcaseBusiness,
            },
            {
                audienceKey: 'web.auth.carousel.slides.recall.personas.teams.audience',
                benefitKey: 'web.auth.carousel.slides.recall.personas.teams.benefit',
                icon: Users,
            },
        ],
    },
    {
        key: 'sync',
        titleKey: 'web.auth.carousel.slides.sync.title',
        descriptionKey: 'web.auth.carousel.slides.sync.description',
        icon: Users,
        accentClassName: SLIDE_ICON_ACCENT_CLASS_NAME,
        personas: [
            {
                audienceKey: 'web.auth.carousel.slides.sync.personas.multiDevice.audience',
                benefitKey: 'web.auth.carousel.slides.sync.personas.multiDevice.benefit',
                icon: Sparkles,
            },
            {
                audienceKey: 'web.auth.carousel.slides.sync.personas.busySchedules.audience',
                benefitKey: 'web.auth.carousel.slides.sync.personas.busySchedules.benefit',
                icon: BriefcaseBusiness,
            },
            {
                audienceKey: 'web.auth.carousel.slides.sync.personas.parents.audience',
                benefitKey: 'web.auth.carousel.slides.sync.personas.parents.benefit',
                icon: Users,
            },
        ],
    },
];

export function IntroCarousel() {
    const { t } = useTranslation();
    const autoplay = useRef(
        Autoplay({
            delay: AUTOPLAY_DELAY_MS,
            stopOnInteraction: false,
        }),
    );
    const [emblaRef, emblaApi] = useEmblaCarousel(
        {
            loop: true,
            align: 'start',
            skipSnaps: false,
        },
        [autoplay.current],
    );
    const [selectedIndex, setSelectedIndex] = useState(0);

    const handleDotClick = useCallback(
        (index: number) => {
            if (!emblaApi) return;
            emblaApi.scrollTo(index);
        },
        [emblaApi],
    );
    const handleDotButtonClick = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            const indexRaw = event.currentTarget.dataset.index;
            if (indexRaw === undefined) return;
            const index = Number(indexRaw);
            if (Number.isNaN(index)) return;
            handleDotClick(index);
        },
        [handleDotClick],
    );
    const handlePrev = useCallback(() => {
        emblaApi?.scrollPrev();
    }, [emblaApi]);
    const handleNext = useCallback(() => {
        emblaApi?.scrollNext();
    }, [emblaApi]);

    const handlePause = useCallback(() => {
        emblaApi?.plugins().autoplay?.stop();
    }, [emblaApi]);

    const handleResume = useCallback(() => {
        emblaApi?.plugins().autoplay?.play();
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;

        const handleUpdate = () => {
            setSelectedIndex(emblaApi.selectedScrollSnap());
        };

        const handlePointerDown = () => {
            emblaApi.plugins().autoplay?.stop();
        };

        const handlePointerUp = () => {
            emblaApi.plugins().autoplay?.play();
        };

        handleUpdate();
        emblaApi.on('select', handleUpdate);
        emblaApi.on('reInit', handleUpdate);
        emblaApi.on('pointerDown', handlePointerDown);
        emblaApi.on('pointerUp', handlePointerUp);
        emblaApi.plugins().autoplay?.play();

        return () => {
            emblaApi.off('select', handleUpdate);
            emblaApi.off('reInit', handleUpdate);
            emblaApi.off('pointerDown', handlePointerDown);
            emblaApi.off('pointerUp', handlePointerUp);
        };
    }, [emblaApi]);

    return (
        <section
            className={cn(
                'relative mx-auto flex w-full max-w-3xl flex-col gap-4 overflow-hidden rounded-xl border border-border/75',
                'bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-accent/20 via-background to-primary/8',
                'p-4 shadow-[0_16px_50px_-38px_rgba(33,62,128,0.58)] sm:p-5 lg:p-6',
            )}
            aria-label={t('web.auth.carousel.title')}
            onMouseEnter={handlePause}
            onMouseLeave={handleResume}
            onFocusCapture={handlePause}
            onBlurCapture={handleResume}
        >
            <div className="pointer-events-none absolute -right-16 -top-14 h-40 w-40 rounded-full bg-accent/28 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-14 h-48 w-48 rounded-full bg-primary/18 blur-3xl" />
            <div className="relative z-10 space-y-2.5">
                <h2 className="max-w-xl text-2xl font-semibold leading-tight text-foreground sm:text-[2rem]">
                    {t('web.auth.carousel.title')}
                </h2>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {t('web.auth.carousel.subtitle')}
                </p>
            </div>

            <div className="relative z-10">
                <div className="overflow-hidden touch-pan-y touch-pinch-zoom" ref={emblaRef}>
                    <div className="flex -ml-4 sm:-ml-5">
                        {SLIDES.map((slide) => (
                            <div key={slide.key} className="min-w-0 shrink-0 grow-0 basis-full pl-4 sm:pl-5">
                                <div className="rounded-2xl border border-border/75 bg-background/88 p-4 backdrop-blur sm:p-5">
                                    <div className="flex items-start gap-3 sm:gap-4">
                                        <div
                                            className={cn(
                                                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11',
                                                slide.accentClassName,
                                            )}
                                        >
                                            <slide.icon className="h-5 w-5" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <h3 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
                                                {t(slide.titleKey)}
                                            </h3>
                                            <p className="text-sm leading-relaxed text-muted-foreground">
                                                {t(slide.descriptionKey)}
                                            </p>
                                        </div>
                                    </div>
                                    <ul className="mt-4 grid gap-2.5 sm:mt-4">
                                        {slide.personas.map((persona) => (
                                            <li
                                                key={persona.audienceKey}
                                                className="flex items-start gap-3 rounded-xl border border-border/75 bg-background/95 p-3.5"
                                            >
                                                <div className={cn('mt-0.5 rounded-md p-1.5', slide.accentClassName)}>
                                                    <persona.icon className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground/85">
                                                        {t(persona.audienceKey)}
                                                    </p>
                                                    <p className="text-sm leading-relaxed text-muted-foreground">
                                                        {t(persona.benefitKey)}
                                                    </p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="relative z-10 mt-1 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 rounded-full border border-border/75 bg-background/85 px-3 py-2 shadow-sm backdrop-blur">
                    {Array.from({ length: SLIDES.length }).map((_, index) => (
                        <button
                            key={`intro-dot-${index}`}
                            type="button"
                            data-index={index}
                            aria-label={t('common.pageNumber', { page: index + 1 })}
                            onClick={handleDotButtonClick}
                            className={cn(
                                'rounded-full transition-all duration-300',
                                selectedIndex === index
                                    ? 'h-2.5 w-9 bg-primary shadow-[0_0_0_3px_rgba(56,128,255,0.18)]'
                                    : 'h-2.5 w-2.5 bg-foreground/45 ring-1 ring-foreground/20 hover:bg-foreground/70',
                            )}
                        />
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        aria-label={t('common.previous')}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-background/95 text-foreground transition-colors hover:bg-accent/20"
                        onClick={handlePrev}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        aria-label={t('common.next')}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-background/95 text-foreground transition-colors hover:bg-accent/20"
                        onClick={handleNext}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </section>
    );
}
